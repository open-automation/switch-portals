// --------- HELPER FUNCTIONS --------- //
//STAGING
//Replacement for old log
function debugLog(s, message) {
	const debug = s.getPropertyValue("Debug") === "Yes"
	if (debug === true) {
		s.log(1, message);
	}
}

//Check if file exist and has arrived
function isFileUsable (s, file) {
	const stableTime = s.getPropertyValue("stableTime");
	if (file.exists) {
		if (file.hasArrived(stableTime)) {
			debugLog(s, file.name + " exist and is stable since " + stableTime + "second(s)");
			return true;
		} else {
			debugLog(s, file.name + " exist but is still in transfer");
			return false;
		}
	} else {
			debugLog(s, file.name + " does not exist");
			return false;
	}
}

//Remove special character
var normalizeChannelProperty = function(s : Switch, value) {
	var re = /[^a-zA-Z0-9\-]/gi;
	var modified = value.replace(re, ""); // Replace
	return modified;
}

// For each helper function
var forEach = function(array, callback) {
	var currentValue, index;
	var i = 0;
	for (i; i < array.length; i ++) {
	  if(typeof array[i] == "undefined") {
		 currentValue = null;
	  } else {	
		 currentValue = array[i];
	  }
	  index = i;
	  callback(currentValue, i, array);
	}
}

// Resolve channel key
var getChannelKey = function(s : Switch, flow, scope, channel, programId) {
	// Prefixes
	var portalNamespace = 'Portals_';
	var segmentSeperator = "_";
	var channelPrefix = 'C-';
	var flowPrefix = 'F-';
	var globalPrefix = 'G-';
	var programPrefix = 'P-';
	var channelKey = portalNamespace;
	if(scope === "Global") {
		channelKey += channelPrefix + channel;
	} else if(scope === "Program") {
		if(programId === "") {
			s.log(3, "Unexpected blank Program ID. Must not be blank if Program Scope selected.");
		}
		channelKey += programPrefix + programId + segmentSeperator + channelPrefix + channel;
	} else {
		channelKey += flowPrefix + flow + segmentSeperator + channelPrefix + channel;
	}
	return channelKey;
};

// Determine directory seperator
var getDirectorySeperator = function(s : Switch) {
	var directorySeperator;
	if(s.isMac()) {
		directorySeperator = '/';
	} else {
		directorySeperator = '\\'
	}
	return directorySeperator;
};

// Delete unprocessable files to stop looping errors
var fatalJobCleaner = function( s : Switch, job : job, filePath ) {
	s.log(3, "Fatal exception occured. Deleting incoming job to prevent looping errors. Contact the Portals dev.");
	var file = new File(filePath);
	file.remove(); // Not working, permissions
	return true;
}

// Check for blanks
function isPropertyValid( s : Switch, tag : String, original : String ) {
	var modified = normalizeChannelProperty(s, original);
	if(modified == "" || original == ""){
		s.log(3, "Value for " + tag + " may not be blank.");
		return false;
	}
	return true;
}



// --------- APPLICATION --------- //

// Restore datasets
var restoreDatasets = function(job : Job, s : Switch, datasetsLocation) {
	var datasetsDir = new Dir(datasetsLocation);
	var datasetEntries = datasetsDir.entryList("*", Dir.Files, Dir.Name);
	// Insert each dataset file found
	if(datasetEntries.length > 0) {
		forEach(datasetEntries, function(datasetFilename, i) {
			model = datasetFilename.substring(datasetFilename.length - 3);
			datasetTag = datasetFilename.substring(0, (datasetFilename.length - 4));
			if(model === "que") {
				model = "Opaque"; // Silly
				datasetTag = datasetFilename.substring(0, (datasetFilename.length - 7));
			}
			sourceDatasetPath = datasetsLocation + getDirectorySeperator(s) + datasetFilename;
			debugLog(s, model + " dataset found: "+ datasetTag);
			dataset = job.createDataset(model);
			if (dataset) {
				datasetBacking = dataset.getPath();
				// Overwrite backing file with source dataset
				datasetCopySuccess = s.copy(sourceDatasetPath, datasetBacking);
				job.setDataset(datasetTag, dataset);
				return true;
			} else {
				s.log(3, model + " dataset (tag: " + datasetTag + ") could not be created.");
				return false;
			}
		});
	}
	return job;
};

// Restore job ticket
var restoreJobTicket = function(job : Job, jobTicketLocation, s) {
	// Helper function
	var splitString = function(string, delimeter) {
		var array = string.split(delimeter);
		return array;
	}
	jobTicketPath = jobTicketLocation + getDirectorySeperator(s) + 'ticket.xml';
	var jobTicketFile = new File(jobTicketPath);
	var jobTicketFileUsable = isFileUsable(s, jobTicketFile);	
	if(jobTicketFileUsable === false) {
		// Something is wrong, read the doc for debugging
		job.log(3, "ticket does not exist");
		// Fail the dummy job
		job.fail("Job ticket could not be restored and the job could not be processed.");
		return false;
//		fatalJobCleaner(s, job, filePath); // Kill the failure
	} else {
		doc = new Document(jobTicketPath);
		if(!doc.isWellFormed()) {
			// Something is wrong, read the doc for debugging
			malformedTicket = File.read(jobTicketPath, "UTF-8");
			job.log(3, "Malformed ticket: "+ malformedTicket);
			// Fail the dummy job
			job.fail("Job ticket could not be restored and the job could not be processed.");
			//fatalJobCleaner(s, job, filePath); // Kill the failure
		}
		docChildren = doc.getChildNodes();
		jobTicketNode = docChildren.getItem(0);
		children = jobTicketNode.getChildNodes();
		// Loop through job ticket nodes
		for(i = 0; i < children.getCount();i++) {
			node = children.getItem(i);
			key = node.getBaseName();
			if(key !== 'getPrivateData') {
				// Standard job ticket field
				textNode = node.getFirstChild();
				if(textNode){
					value = textNode.getValue();
					debugLog(s, "Restoring job ticket part - " + key + ": " + value);
					// Restore
					if(key == 'getJobState') job.setJobState(value);
					if(key == 'getPriority') job.setPriority(value);
					if(key == 'getEmailBody') job.setEmailBody(value);
					if(key == 'getEmailAddresses') job.setEmailAddresses(splitString(value, ","));
					if(key == 'getUserEmail') job.setUserEmail(value);
					if(key == 'getUserName') job.setUserName(value);
					if(key == 'getUserFullName') job.setUserFullName(value);
					if(key == 'getHierarchyPath') job.setHierarchyPath(splitString(value, ","));
					if(key == 'getUniqueNamePrefix') oldUniqueNamePrefix = value;
					if(key == 'getName') oldName = value;
				}
			} else {
				// Private data
				debugLog(s,  "Found private data");
				pdChildren = node.getChildNodes();
				// For each PD
				for(index = 0; index < pdChildren.getCount(); index++){
					pdNode = pdChildren.getItem(index);
					key = pdNode.getAttributeValue('key');
					debugLog(s,  "Restoring PD key: " + key)
					textNode = pdNode.getFirstChild();
					if(textNode){
						value = textNode.getValue();
					}
					// Set PD
					job.setPrivateData(key, value);
				}
			}
		}
		returnObject = {
			job: job,
			oldUniqueNamePrefix: oldUniqueNamePrefix,
			oldFileName: oldName
		};
		return returnObject;
	}

};

// Unarchive and return temporary location for writing
var unarchive = function(job : Job, s : Switch, filePath) {
	var currentDate = new Date();
	var unpackDestination = job.createPathWithName("unarchiveTemp"+job.getUniqueNamePrefix(), true);
	var unarchiveSuccess = s.unarchive(filePath, unpackDestination);
	if(unarchiveSuccess == 0) {
		s.log(3, "Unarchiving of the job to the temporary folder was unsuccessful.");
		return false;
	}
	return unpackDestination;
};

// Invokes other restore functions


function restoreMetadata(fileName, filePath, job : Job, s : Switch) {
//var restoreMetadata = function(fileName, filePath, job : Job, s : Switch) {
	var unpackDestination;
	var unarchiveResponse = unarchive(job, s, filePath);
	if(unarchiveResponse === false) {
		return false;
	} else {
		unpackDestination = unarchiveResponse;
	}
	contentsLocation = unpackDestination + getDirectorySeperator(s) + "contents";
	datasetsLocation = unpackDestination + getDirectorySeperator(s) + "datasets";
	jobTicketLocation = unpackDestination + getDirectorySeperator(s) + "jobTicket";
	debugLog(s, "unpackDestination: "+unpackDestination);
	debugLog(s, "contentsLocation: "+contentsLocation);
	var jobWithDatasets = restoreDatasets(job, s, datasetsLocation);
	var jobTicketRestoreReturn = restoreJobTicket(jobWithDatasets, jobTicketLocation, s);
	if (jobTicketRestoreReturn === false){
		return false
	} else {
		var jobWithJobTicket = jobTicketRestoreReturn.job;
		restoreReturn = {
			job: jobWithJobTicket,
			unpackDestination: unpackDestination,
			oldUniqueNamePrefix: jobTicketRestoreReturn.oldUniqueNamePrefix,
			oldFileName: jobTicketRestoreReturn.oldFileName
		};
		return restoreReturn;
	}
};

// Unpacking function
var unpackJob = function(s : Switch, packedFilePath, fileName, tempFolder) {
	// Create a dummy job
	var job = s.createNewJob(fileName);
	// Do it
	var restoreReturn = restoreMetadata(fileName, packedFilePath, job, s);
	if(restoreReturn === false) {
		return false;
	} else {
		try {
			// Remove the archive
			File.remove(packedFilePath);
		} catch (e) {
			s.log(3, "Unpacked job could not be removed after job creation and metadata restoration. " + e);
		}
		return restoreReturn;
	}
};

// --------- MainFunction --------- //
function timerFired( s : Switch ) {
	// Get some variables
	var channel = normalizeChannelProperty(s, s.getPropertyValue("Channel"));
	var scope = normalizeChannelProperty(s, s.getPropertyValue("Scope"));
	var programId = normalizeChannelProperty(s, s.getPropertyValue("ProgramId"));
	var flow = s.getFlowName();

	// Create ether path from ScriptData folder
	var etherName = "SwitchPortalsEther";
	var scriptDataFolder = s.getSpecialFolderPath("ScriptData");
	var etherPath = scriptDataFolder + getDirectorySeperator(s) + etherName;
	// Determine channel from properties
	var channelKey = getChannelKey(s, flow, scope, channel, programId);
	var channelFolder = etherPath + getDirectorySeperator(s) + channelKey + getDirectorySeperator(s);
	var tempFolder = channelFolder + getDirectorySeperator(s) + "temp" + getDirectorySeperator(s);

	// Set the timerInterval on start
	var scanInterval = s.getPropertyValue("scanInterval");
	if (s.getTimerInterval() == 0) {
		s.setTimerInterval(scanInterval);
	}
	debugLog(s, "Channel folder: "+channelFolder);
	// Look for files in the channel
	var dir = new Dir(channelFolder);
	var packedChannelJobs = dir.entryList("*", Dir.Files, Dir.Name);
	if(packedChannelJobs.length > 0) {
		debugLog(s, "Files found: "+packedChannelJobs.length);
		// Insert each job found
		forEach(packedChannelJobs, function(fileName, i) {
			debugLog(s, "Picking up file " + (i+1) + ": " + fileName);
			var packedFilePath = channelFolder + fileName;
			var file = new File(packedFilePath);
			var FileUsable = isFileUsable(s, file);
			if (FileUsable === false) {
				s.log(2, "File is not stable. Skipping this file" );
			} else {
				unpackReturn = unpackJob(s, packedFilePath, fileName, tempFolder);
				if(unpackReturn === false) {
					s.log(3, "unpackJob returned false. Could not unpack. Skipping this file.");
				} else {
					job = unpackReturn.job;
					unpackDestination = unpackReturn.unpackDestination;
					oldFileName = unpackReturn.oldFileName;
					contentPath = unpackDestination + getDirectorySeperator(s) + "contents"+ getDirectorySeperator(s) + oldFileName;
					debugLog(s, "contentPath: "+contentPath);
					job.sendToSingle(contentPath);
				}
			}
		});
	}
	return;
}