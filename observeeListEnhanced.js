// not 100% up on modern javascript design patterns, but enclosing all functions in the getObservees parent function
// this would generate quite a bit of traffic if you have a lot of observees
// have to think about how this scales.

function getObservees(){
	
	if (! /^\/profile\/observees$/.test(window.location.pathname) ){
		return;
	}
	
	var url = "/api/v1/users/self/observees?per_page=30";
	
	// an array of observee objects
	var observeeList = [];
	var dataTableInitialized = false;
	var currentUser = "";
	var lastUser = "";
	var dataTablesScriptLoaded = false;
	var $observeeTable = $("<table>", {id: "observeeTable", "class": "display", "style": "width:100%"});


	loadDataTables();
	
	// this page already calls the list so hook onto it
	$(document).ajaxSuccess(function(event, request, settings) {
		
		// interestingly the url may include the full domain name
		if (/\/api\/v1\/users\/[0-9]+\/observees/.test(settings.url)){
			data = JSON.parse(request.responseText);
			// console.log(data);
			// console.log(request);
			$.each ( data, function (key, user) {
					// console.log(user.sortable_name + ": " + user.id );
					observeeList[user.id] = {"name" : user.sortable_name, "id" : user.id, "enrollments" : []};
					currentUser = user.id;
					getEnrollmentsByGraphQL(user.id);
				});
			var nextlink = getNextLink(request);
			if (nextlink == ''){
				// console.log('Observees list generated');
				lastUser = currentUser;
			}
		}
	});


	// https://datatables.net/examples/basic_init/zero_configuration.html
	// loading css, js and creating the table structure
	// not really taking full advantage of what the library can do, but React is also difficult to deal with
	// https://datatables.net/examples/plug-ins/range_filtering.html might be handy for the date fields
	function loadDataTables(){
		
		var css = "https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css";
		$('head').append( $('<link rel="stylesheet" type="text/css" />').attr('href', css) );

		var js = "https://cdn.datatables.net/1.10.20/js/jquery.dataTables.min.js";
		$.getScript( js, function( data, textStatus, jqxhr ) {
				// console.log( "DataTables load was performed." );
				dataTablesScriptLoaded = true;
			});

		// create data table
		// var $observeeTable = $("<table>", {id: "observeeTable", "class": "display", "style": "width:100%"});
		

		//console.log($observeeTable);

		// header row
		var headerRow = $('<tr>').append(
			$('<th>').text("Student"),
			$('<th>').text("Last Canvas Access"),
			$('<th>').text("Course ID"),
			$('<th>').text("Last Course Access"),
			$('<th>').text("Grade"),
			$('<th>').text("Score"),
			$('<th>').text("Missing Assignments")
			);

		// head and body of table
		$('<thead>').append(headerRow).appendTo($observeeTable);

   		$('<tbody>').appendTo($observeeTable);

   		//console.log($observeeTable);
   		//console.log($observeeTable[0].tBodies[0]);

	}

	// once we have the complete information about the user, we add them to the table
	// another approach here would be to build an array suitable for passing to DataTables
	function addUserToTable(user_id){
		observeeList[user_id].lastAccess = (observeeList[user_id].lastAccess==null) ? "Never": Date.parse(observeeList[user_id].lastAccess).toLocaleString();
		var studentName = observeeList[user_id].name;
		var studentLastAccess = (observeeList[user_id].lastAccess==null) ? "Never": Date.parse(observeeList[user_id].lastAccess).toLocaleString();
		

		$.each ( observeeList[user_id].enrollments, function (key, enrollment) {
				enrollment.currentGrade = (enrollment.currentGrade==null) ? "": enrollment.currentGrade;
				enrollment.currentScore = (enrollment.currentScore==null) ? "": enrollment.currentScore;
				var courseLastAccess = (enrollment.lastAccess==null) ? "Never": Date.parse(enrollment.lastAccess).toLocaleString();
				
				$('<tr>', {id: user_id + "-" + enrollment.courseID}).append(
					$('<td>').html(studentName),
					$('<td>').data("studentLastAccess", observeeList[user_id].lastAccess).html(studentLastAccess),
					$('<td>').html("<a href=\"/courses/" + enrollment.courseID + "/grades/" + user_id + "\">" + enrollment.courseCode + "</a>"),
					$('<td>').data("courseLastAccess", enrollment.lastAccess).text(courseLastAccess),
					$('<td>').text(enrollment.currentGrade),
					$('<td>').text(enrollment.currentScore),
					$('<td>', {id: user_id + "-" + enrollment.courseID + "-missing"}).text(enrollment.missingSubmissions)
					).appendTo($observeeTable[0].tBodies[0]);
				//studentName = "<span style=\"opacity: 0;\">" + studentName + "</span>";
				//studentLastAccess = "<span style=\"opacity: 0;\">" + studentLastAccess + "</span>";
			});
			
		// best guess that we are working on the last rows of data
		// ajaxStop waits till all is done, but we could introduce a delay in getting missing assignment data
		$(document).ajaxStop(function () {
			if (!dataTableInitialized && user_id == lastUser && dataTablesScriptLoaded){

				//$($observeeTable).DataTable();
				dataTableInitialized = true;
				// can't click if it doesn't exist
				// $('#observeeTable th')[0].click();

				// hide the existing list
				$(".observees-list.collectionViewItems").hide();
				// add the table to the existing container
				$(".observees-list-container").append($observeeTable);
				$("#observeeTable").DataTable({
						"order": [[ 0, "asc" ]]
					});
			}
		});
	}

	// add enrollment object data to the user in the base array
	function addEnrollmentToObservee(user_id, enrollment){
		observeeList[user_id].enrollments.push( {"lastAccess" : enrollment.lastActivityAt, "courseCode" : enrollment.course.courseCode, "courseID" : enrollment.course._id, "currentGrade" : enrollment.grades.currentGrade, "currentScore" : enrollment.grades.currentScore, "missingSubmissions" : 0} );
		if (observeeList[user_id].lastAccess){
			// is the date of this enrollment more recent than the stored information on the user
			if (Date.parse(observeeList[user_id].lastAccess) < Date.parse(enrollment.lastActivityAt)){
				observeeList[user_id].lastAccess = enrollment.lastActivityAt;
			}
		}
		else {
			observeeList[user_id].lastAccess=enrollment.lastActivityAt;
		}
	}

	// just counting the missing submissions and adding them to the total for the course for the user
	function addToMissingSubmissionsCtForUser(user_id, course_code){
		$.each ( observeeList[user_id].enrollments, function (key, enrollment) {
				if (enrollment.courseCode == course_code){
						enrollment.missingSubmissions ++;
						var tc = $("#" + user_id + "-" + enrollment.courseID + "-missing");
						tc.text(enrollment.missingSubmissions);
						if (theTable.cell){
						    theTable.cell("#" + user_id + "-" + enrollment.courseID + "-missing").data(enrollment.missingSubmissions);
						}
				}
			});
	}

	// use graphql API enables us to get coursecode and lastactivity in addition to grades
	// also, as best I can tell this does not use pagination
	// https://yourCanvasInstance/graphiql
	function getEnrollmentsByGraphQL(user_id, linkToGet){
		//console.log("Getting enrollments for " + user_id);
		var url = "/api/graphql";
		var query="query enrollmentInfo {\
					  legacyNode(_id: " + user_id + ", type: User) {\
						... on User {\
						  _id\
						  name\
						  enrollments {\
							lastActivityAt\
							course {\
							  courseCode\
							  _id\
							}\
							grades {\
							  currentGrade\
							  currentScore\
							  unpostedCurrentGrade\
							  unpostedCurrentScore\
							  unpostedFinalGrade\
							  unpostedFinalScore\
							}\
						  }\
						}\
					  }\
					}";
		var dataElement = {"query": query,
						"variables": null,
						"operationName": "enrollmentInfo"
			};
		//console.log(dataElement);
		$.ajax({
			url: url,
			type: 'POST',
			data: JSON.stringify(dataElement),
			contentType: "application/json; charset=utf-8",
			dataType: "json",
			success: function(data,textStatus,xhr) {
					// the first element returned in the graphql data is called data
					//console.log(data.data);
					$.each ( data.data.legacyNode.enrollments, function (key, enrollment) {
							//console.log(enrollment);
							addEnrollmentToObservee(user_id, enrollment);
							//console.log(user_id + " " + course.course_code + ": " );
							//if (course.enrollments){
							//	console.log(course.enrollments[0].computed_current_grade + "/" + course.enrollments[0].computed_current_score);
							//}
						});
					// get any missing submission data - separate API call, although I would guess it is technically possible in graphql
					// I just could not work out how
					// build the row before we have the missing submission data
					addUserToTable(user_id);
					setTimeout(getMissingSubmissions, 1000 + Math.floor(Math.random() * 500), user_id);
					// getMissingSubmissions(user_id);
				}
			});
	}

	// getting missing submissions
	function getMissingSubmissions(user_id, linkToGet){
		//console.log("Getting missing submissions for " + user_id);
		var url = "/api/v1/users/" + user_id + "/missing_submissions?include[]=planner_overrides&include[]=course&filter[]=submittable&as_user_id=" + user_id;
		if (linkToGet != null){
			url = linkToGet;
		}
		//console.log(url);
		$.ajax({
			url: url,
			type: 'GET',
			success: function(data,textStatus,xhr) {
					$.each ( data, function (key, submission) {
							// console.log(submission);
							//console.log(user_id + " " + submission.course.course_code + ": " + submission.name);
							addToMissingSubmissionsCtForUser(user_id, submission.course.course_code);
						});
					var nextlink = getNextLink(xhr);
					//console.log(nextlink);
					if (nextlink !== ''){
						// cannot do simple loops because ajax is asynchronous
						getMissingSubmissions (user_id, nextlink);
					}
					// else {
						// last page so we are ready to add the user data to the table
						// moved to getEnrollmentsByGraphQL
						// addUserToTable(user_id);
					// }
				}
			});
	}

	// utility function to extract the next link from the ajax headers
	function getNextLink(xhr){
		var links = xhr.getResponseHeader("link"); 
		var linksArr =links.split(',');
		var nextlink = '';
		var thislink = '';
		for (var x=0; x<linksArr.length; x++){
			thislink = linksArr[x];
			if (thislink.indexOf('rel="next"')>-1){
				nextlink = thislink.split('>')[0].substring(1);
			}
		}
		return nextlink;
	}
}

if (/^\/profile\/observees$/.test(window.location.pathname) ){
	getObservees();
}
