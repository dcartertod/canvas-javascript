// /api/v1/courses/8/folders?per_page=30

// /api/v1/courses/8/folders/root

// /api/v1/courses/8/files?per_page=30

// /api/v1/courses/8/modules?per_page=30

// /doc/api/files.html#method.folders.create


function getNextLink(xhr){
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


function iterateModules(course_id, rootFolderID, linkToGet){
	var url = "/api/v1/courses/" + course_id + "/modules?per_page=100";
	if (linkToGet != null){
		url = linkToGet;
	}
	$.ajax({
		url: url,
		type: 'GET',
		success: function(data,textStatus,xhr) {
				$.each ( data, function (key, module) {
						console.log(module.name);
						getFolderByName(course_id, module.name, module.items_url, rootFolderID);
						//iterateItems(module.items_url, rootFolderID, module.name, course_id)
					});
				var nextlink = getNextLink(xhr);
				//console.log(nextlink);
				if (nextlink !== ''){
					// cannot do simple loops because ajax is asynchronous
					setTimeout(iterateModules, 5000 + Math.floor(Math.random() * 500), course_id, rootFolderID, nextlink);
				}
			}
		});
}


function getRootFolder(course_id){
	var url = "/api/v1/courses/" + course_id + "/folders/root";
	$.ajax({
	url: url,
	type: 'GET',
	success: function(folder) {
				console.log(folder);
				var rootFolderID=folder.id;
				iterateModules(course_id, rootFolderID, null);
		}
	});
}

function createFolder(course_id,folderName, itemsurl, rootFolderID){
	console.log ("creating " + folderName );
	var url = "/api/v1/courses/" + course_id + "/folders";
	$.ajax({
	url: url,
	type: 'POST',
	// defaulting to the root course context
	data: "name=" + encodeURIComponent(folderName) + "&parent_folder_path=/",
	success: function(newFolder) {
				console.log(newFolder);
				// newFolder.id is the folder id
				// do something with folderid
				iterateItems(itemsurl, rootFolderID, newFolder.id, course_id);
		}
	});
}

function getFolderByName(course_id, folderName, itemsurl, rootFolderID){
	// surely no-one has more than 100 folders
	console.log("working on the folders listing");
	var url = "/api/v1/courses/" + course_id + "/folders?per_page=100";
	$.ajax({
	url: url,
	type: 'GET',
	success: function(data) {
			var folderid;
			$.each ( data, function (key, folder) {
					//console.log(folder);
					if (folder.name == folderName){
						folderid = folder.id;
					}
				});
			if (folderid == null){
				createFolder(course_id, folderName, itemsurl, rootFolderID);
			}
			else{
				// do something with folderid
				iterateItems(itemsurl, rootFolderID, folderid, course_id);
			}
		}
	});
}

function iterateItems(itemsurl, rootFolderID, folderid, course_id){
	console.log("Iterating on " + itemsurl);
	$.ajax({
	url: itemsurl,
	type: 'GET',
	success: function(data,textStatus,xhr) {
			$.each ( data, function (key, item) {
					//console.log(item);
					if (item.type=="File"){
						//getFolderByName(course_id, folderName, item.url, rootFolderID);
						// need to know the course files root folder id and the target module folder id
						// if file folder_id is the root id, then move it to a module folder
						//console.log(item);
						// item.url is the path to the json which is an object with a folder_id value
						moveItem(item.url, rootFolderID, folderid);
					}
					if (item.type == 'Page'){
						extractFilesFromPage(item.url, rootFolderID, folderid);
					}
				});
			var nextlink = getNextLink(xhr);
			//console.log(nextlink);
			if (nextlink !== ''){
				// cannot do simple loops because ajax is asynchronous
				setTimeout(iterateItems, 5000 + Math.floor(Math.random() * 500), nextlink, rootFolderID, folderid, course_id);
			}
		}
	});
}

function extractFilesFromPage(itemurl, rootFolderID, folderid){
	console.log('Working on a page');
	$.ajax({
	url: itemurl,
	type: 'GET',
	success: function(pagedata){
			var links = $(pagedata.body).find("a[data-api-returntype='File']");
			
			$.each(links, function (key, link) {
				//console.log($(link).attr('data-api-endpoint'));
				moveItem($(link).attr('data-api-endpoint'), rootFolderID, folderid);
			});
		}
	});
}

function moveItem(itemurl, rootFolderID, folderid){
	//console.log("Checking " + itemurl);
	$.ajax({
	url: itemurl,
	type: 'GET',
	success: function(filedata){
			// only move if currently stored in the root
			if (filedata.folder_id == rootFolderID){
				moveItemToFolder(filedata.id, folderid);
			}
		}
	});
}

function moveItemToFolder(itemid, folderid){
	console.log("moving " + itemid + " to " + folderid);
	var itemurl = "/api/v1/files/" + itemid;
	$.ajax({
	url: itemurl,
	type: 'PUT',
	data: "parent_folder_id=" + folderid,
	success: function(filedata){
		console.log(filedata.display_name + " moved");
		}
	});	
}

// for cleanup afterwards
function deleteEmptyFolders(course_id){
	// surely no-one has more than 100 folders
	console.log("working on the folders listing");
	var url = "/api/v1/courses/" + course_id + "/folders?per_page=100";
	$.ajax({
	url: url,
	type: 'GET',
	success: function(data) {
			var folderid;
			$.each ( data, function (key, folder) {
					//console.log(folder);
					if (folder.parent_folder_id != null && folder.files_count==0 && folder.folders_count==0){
						deleteFolder(folder.id);
					}
				});
		}
	});
}

function deleteFolder(folderid){

	console.log("deleting a folder");
	var url = "/api/v1/folders/" + folderid ;
	$.ajax({
	url: url,
	type: 'DELETE',
	success: function(data) {
			console.log("deleted");
		}
	});
}


// start on the course page
if(/^\/courses\/\d+/.test(window.location.pathname)){
	var course_id=window.location.pathname.split('/')[2];
	getRootFolder(course_id);
	// after it is complete do this
	// deleteEmptyFolders(course_id)
}