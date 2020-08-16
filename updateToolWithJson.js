// this is the good stuff - just need a url and an update object that can have a new key or an existing one

// take the object that you got from the url and update it with the partial object you have
function updateObjVal(object, searchObj) {
	//console.log(object);
    Object.keys(searchObj).forEach(function (k) {
        if (object[k] && typeof object[k] === 'object' && typeof searchObj[k] === 'object') {
            return updateObjVal(object[k], searchObj[k])
        }
		else{
			object[k] = searchObj[k];
		}
    });
	return object;
}

// get the existing json from the url
function updateTool(url, updateObj){
	$.ajax({
	url: url,
	type: 'GET',
	success: function(data) {
			// console.log(data);
			//console.log(updateObj);
			var updatedObj = updateObjVal(data,updateObj);
			putUpdate(url,updatedObj);
		}
	});
}

// send the updated json back
function putUpdate(url, updatedObj){
	console.log(updatedObj);
	var updateString = decodeURIComponent(jQuery.param( updatedObj ));
	$.ajax({
		url: url,
		type: 'PUT',
		data: updateString,
		success: function(data) {
			console.log('Tool was updated.');
			}
		});
}

// e.g. /api/v1/courses/281820/external_tools/22087 visible from network panel in console
var targeturl="/api/v1/accounts/44/external_tools/24998";
/* var updateObj = {"course_navigation": {"enabled": "true",
					"text": "VHL Central",
					"visibility": "public",
					"windowTarget": "_blank",
					"label": "VHL Central",
					"default": "disabled"}
					}; */
var updateObj = {"course_navigation": {"default": "disabled"}};
updateTool( targeturl, updateObj );








