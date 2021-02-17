function getNextLink(xhr){
	//return ''; // testing
	var links = xhr.getResponseHeader("link"); 
	var linksArr =links.split(',');
	var nextlink = '';
	var thislink = '';
	for (var x=0; x<linksArr.length; x++){
		thislink = linksArr[x];
		if (thislink.indexOf('rel="next"')>-1){
			nextlink = thislink.split('>')[0].substring(1);
			//console.log(nextlink);
		}
	}
	return nextlink;
}

function getAccountOutcomes(targetCourseId = "8", subjectNumber = 'ADJ 127', account = '1', nextlink=""){
	var subject = subjectNumber.split(' ')[0];
	console.log(subject);
	var url = '/api/v1/accounts/' + account + '/outcome_groups';
	if ( nextlink != "" ){
		url = nextlink;
	}
	
	if (sessionStorage[subject]){
		var subjectGroupUrl = sessionStorage[subject];
		getSubjectNumberOutcomes(sessionStorage[subject], subjectNumber, targetCourseId);
	}
	else {
		$.ajax({
		url: url,
		type: 'GET',
		success: function(data,textStatus,xhr) {
				// console.log(data);
				var subjectGroupUrl;
				$.each ( data, function (key, item) {
					// console.log(item);
					// cache or match
					subjectGroupUrl = item.subgroups_url;
					sessionStorage[vendor_guid] = subjectGroupUrl;
					if ( item.parent_outcome_group && item.parent_outcome_group.id == 1 && item.vendor_guid == subject ){
							//console.log (item);
							setTimeout(getSubjectNumberOutcomes, delay*delayct, subjectGroupUrl, subjectNumber, targetCourseId);
							return;
					}
				});
				var nextlink = getNextLink(xhr);
				if (nextlink !== '' && subjectGroupUrl == null){
					  setTimeout(getAccountOutcomes, delay*delayct, targetCourseId, subjectNumber, account, nextlink);
				}
			}
		});
	}
}

function getSubjectNumberOutcomes(subjectGroupUrl, subjectNumber, targetCourseId ="8", foundItem = {"id": "0","vendor_guid": "0"}){
	delayct ++;
	
	if (sessionStorage[subjectNumber]){
		var accountGroupId = sessionStorage[subjectNumber];
		getCourseOutcomeGroups (targetCourseId, subjectNumber, accountGroupId);
	}
	else {
		$.ajax({
		url: subjectGroupUrl,
		type: 'GET',
		success: function(data,textStatus,xhr) {
				// var foundItem = {"id": "0","vendor_guid": "0"};
				$.each ( data, function (key, item) {
					sessionStorage[item.title] = item.id;
					if ( item.title == subjectNumber ){
							// there may be multiple with the same name, but different vendor_guid based on date
							// we want the most recent
							if (foundItem.vendor_guid < item.vendor_guid){
								foundItem = item;
							}
					}
				});
				// console.log(foundItem);
				// if (foundItem.id > "0"){
				// 	console.log (foundItem);
				// }
				var nextlink = getNextLink(xhr);
				if (nextlink !== ''){
					  setTimeout(getSubjectNumberOutcomes, delay*delayct, nextlink, subjectNumber, targetCourseId, foundItem);
				}
				else if (foundItem.id > "0") {
					// do something with foundItem
					// console.log(foundItem);
					var accountGroupId = foundItem.id;
					// sessionStorage[subjectNumber] = accountGroupId;
					setTimeout(getCourseOutcomeGroups, delay*delayct, targetCourseId, subjectNumber, accountGroupId);
				}
				else {
					console.log("No outcomes found for " + subjectNumber);
				}
			}
		});
	}
}

function getCourseOutcomeGroups(targetCourseId, subjectNumber, accountGroupId, nextlink="", courseImportUrl){
	delayct ++;
	var flHasGroupAlready = false;
	var url = '/api/v1/courses/' + targetCourseId + '/outcome_groups';
	if ( nextlink != "" ){
		url = nextlink;
	}
	$.ajax({
	url: url,
	type: 'GET',
	success: function(data,textStatus,xhr) {
			// console.log(data);
			$.each ( data, function (key, item) {
				// console.log(item);
				if (item.title == subjectNumber){
					flHasGroupAlready = true;
				}
				if (! item.parent_outcome_group){
					// course root outcome
					courseImportUrl = item.import_url;
				}
				
			});
			var nextlink = getNextLink(xhr);
			if (flHasGroupAlready){
				console.log("Course already has an outcome group for " + subjectNumber);
				console.log("/courses/" + targetCourseId + "/outcomes");
				return;
			}
			else if (nextlink !== ''){
				setTimeout(getCourseOutcomeGroups, delay*delayct, targetCourseId, subjectNumber, accountGroupId, nextlink, courseImportUrl);
			}
			else {
				// console.log ('import to course');
				setTimeout(importOutcomeGroupToCourse, delay*delayct, courseImportUrl, accountGroupId, targetCourseId);
			}
		}
	});
}

function importOutcomeGroupToCourse(courseImportUrl, accountGroupId, targetCourseId){
	// need to get the target group and make sure something has not been imported already
	// console.log(courseImportUrl, accountGroupId);
	// return;
	delayct ++;
	$.ajax({
		url: courseImportUrl,
		type: 'POST',
		data: 'source_outcome_group_id=' + accountGroupId + '&async=true',
		success: function(data) {
			console.log('Outcome Group was queued to import to course.');
			console.log("/courses/" + targetCourseId + "/outcomes");
			}
		});
}

function importOutcomesToCourse(course){
	// get subject and number from SIS course code
	if (course.sis_course_id){
		var courseIdArray = course.sis_course_id.split('.');
		var subjectNumber = courseIdArray[1] + " " + courseIdArray[2];
		delayct ++;
		setTimeout(getAccountOutcomes, delay*delayct, course.id, subjectNumber);
	}
}

var delay = 300;
var delayct = 0;
var course={"id": 8, "sis_course_id": "SO261.UMS.211.01.SP20"};

importOutcomesToCourse(course);
