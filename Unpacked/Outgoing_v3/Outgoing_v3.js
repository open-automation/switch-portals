var normalizeChannelProperty = function(s : Switch, value){
	var re = /[^a-zA-Z0-9\-]/gi;
    var modified = value.replace(re, ""); // Replace
	return modified;
}

// For each helper function
var forEach = function(array, callback){
   var currentValue, index;
   var i = 0;
   for (i; i < array.length; i += 1) {
      if(typeof array[i] == "undefined"){
         currentValue = null;
      } else {   
         currentValue = array[i];
      }
      index = i;
      callback(currentValue, i, array);
    }
}

// Resolve channel key
var getChannelKey = function(s : Switch, flow, scope, channel, programId){
   // Prefixes
   var portalNamespace = 'Portals_';
   var segmentSeperator = "_";
   var channelPrefix = 'C-';
   var flowPrefix = 'F-';
   var globalPrefix = 'G-';
   var programPrefix = 'P-';
   
   var channelKey = portalNamespace;

   if(scope == "Global"){
       channelKey += channelPrefix + channel;
	} else if(scope == "Program"){
		if(programId == ""){
			s.log(3, "Unexpected blank Program ID. Must not be blank if Program Scope selected.");
		}
		channelKey += programPrefix + programId + segmentSeperator + channelPrefix + channel;
   } else {
       channelKey += flowPrefix + flow + segmentSeperator + channelPrefix + channel;
   }

   //s.log(2, "channelKey: "+channelKey); // Remove
   
   return channelKey;
};

// Determine directory seperator
var getDirectorySeperator = function(s : Switch){
    var directorySeperator;
    if(s.isMac()){
        directorySeperator = '/';
    } else {
        directorySeperator = '\\'
    }
    return directorySeperator;
};


// Delete unprocessable files to stop looping errors
var fatalJobCleaner = function( s : Switch, job : job, filePath )
{
	s.log(3, "Fatal exception occured. Deleting incoming job to prevent looping errors. Contact the Portals dev.");
	var file = new File(filePath);		
	file.remove(); // Not working, permissions
	return true;
}

function isPropertyValid( s : Switch, tag : String, original : String )
{	
    var modified = normalizeChannelProperty(s, original);
	
	//s.log(2, "origial:" + value);
	//s.log(2, "modified:" + modified);
	
	// Check for blanks
	if(modified == "" || original == ""){
		s.log(3, "Value for " + tag + " may not be blank.");
		return false;
	}
	
	return true;
}

// Restore datasets
var restoreDatasets = function(job : Job, s : Switch, datasetsLocation, verboseDebugging){
    var datasetsDir = new Dir(datasetsLocation);
    var datasetEntries = datasetsDir.entryList("*", Dir.Files, Dir.Name);
		
    // Insert each dataset file found
	if(datasetEntries.length > 0){
		forEach(datasetEntries, function(datasetFilename, i){	
			model = datasetFilename.substring(datasetFilename.length - 3);
			datasetTag = datasetFilename.substring(0, (datasetFilename.length - 4))
			
			sourceDatasetPath = datasetsLocation + getDirectorySeperator(s) + datasetFilename;

			if(verboseDebugging === true){
			    s.log(-1, model + " dataset found: "+ datasetTag);
			}
	
			dataset = job.createDataset(model);
			datasetBacking = dataset.getPath();
			
			// Overwrite backing file with source dataset
			datasetCopySuccess = s.copy(sourceDatasetPath, datasetBacking);
			job.setDataset(datasetTag, dataset);
			
			return true;
	    });
	}
	    
    return job;
};

// Restore job ticket
var restoreJobTicket = function(job : Job, jobTicketLocation, s, verboseDebugging){
	
	// Helper function
	var splitString = function(string, delimeter){
		var array = string.split(delimeter);
		return array;
	}

   jobTicketPath = jobTicketLocation + getDirectorySeperator(s) + 'ticket.xml';
	
	var doc = new Document(jobTicketPath);	
	if(!doc.isWellFormed()){
		// Something is wrong, read the doc for debugging
		malformedTicket = File.read(jobTicketPath, "UTF-8");
		job.log(3, "Malformed ticket: "+ malformedTicket);
		// Fail the dummy job
		job.fail("Job ticket could not be restored and the job could not be processed.");
		fatalJobCleaner(s, job, jobTicketPath); // Kill the failure
	}
	var docChildren = doc.getChildNodes();
	var jobTicketNode = docChildren.getItem(0);
				
	var children = jobTicketNode.getChildNodes();
	
	var i, node, key, value, textNode, oldUniqueNamePrefix, oldName;
	
	// Replace with foreach
	for(i = 0; i < children.getCount();i++){		

		node = children.getItem(i);

		key = node.getBaseName();
		
		if(key !== 'getPrivateData'){
			// Standard job ticket field
			textNode = node.getFirstChild();					
			if(textNode){
				value = textNode.getValue();
				
				// Log
				if(verboseDebugging === true){
					s.log(-1, 'Restoring job ticket part - ' + key + ': ' + value);
				}
					
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
			if(verboseDebugging === true){
				s.log(-1, "Found private data");
			}
				
			pdChildren = node.getChildNodes();
			
			// For each PD
			for(index = 0; index < pdChildren.getCount();index++){
				
				pdNode = pdChildren.getItem(index);
				key = pdNode.getAttributeValue('key');
				
				if(verboseDebugging === true){
					s.log(-1, "Restoring PD key: "+key);
				}
				
				textNode = pdNode.getFirstChild();
				if(textNode){
					value = textNode.getValue();	
				}
			
				// Set PD
				job.setPrivateData(key, value);
			}
		}
	}
	
    var returnObject = {
        job: job,
        oldUniqueNamePrefix: oldUniqueNamePrefix,
        oldFileName: oldName
    };

    return returnObject;
	
};

// Unarchive and return temporary location for writing
var unarchive = function(job : Job, s : Switch, filePath){
	var currentDate = new Date();
	var unpackDestination = job.createPathWithName("unarchiveTemp"+job.getUniqueNamePrefix(), true);
	var unarchiveSuccess = s.unarchive(filePath, unpackDestination);
	if(unarchiveSuccess == 0){
		s.log(3, "Unarchiving of the job to the temporary folder was unsuccessful.");
		return false;
	}
	return unpackDestination;
};

// Invokes other restore functions
var restoreMetadata = function(fileName, filePath, job : Job, s : Switch, verboseDebugging){

	var unpackDestination;
	var unarchiveResponse = unarchive(job, s, filePath);
	if(unarchiveResponse === false){
		return false;
	} else {
		unpackDestination = unarchiveResponse;
	}
    contentsLocation = unpackDestination + getDirectorySeperator(s) + "contents";
    datasetsLocation = unpackDestination + getDirectorySeperator(s) + "datasets";
    jobTicketLocation = unpackDestination + getDirectorySeperator(s) + "jobTicket";
    
	if(verboseDebugging === true){
        s.log(-1, "unpackDestination: "+unpackDestination);
        s.log(-1, "contentsLocation: "+contentsLocation);
	}

    var jobWithDatasets = restoreDatasets(job, s, datasetsLocation, verboseDebugging);
    var jobTicketRestoreReturn = restoreJobTicket(jobWithDatasets, jobTicketLocation, s, verboseDebugging);
    var jobWithJobTicket = jobTicketRestoreReturn.job;

    restoreReturn = {
        job: jobWithJobTicket,
        unpackDestination: unpackDestination,
        oldUniqueNamePrefix: jobTicketRestoreReturn.oldUniqueNamePrefix,
        oldFileName: jobTicketRestoreReturn.oldFileName
    };

    return restoreReturn;
};
		
// Unpacking function
var unpackJob = function(s : Switch, packedFilePath, fileName, tempFolder, verboseDebugging){
 
    // Create a dummy job
    var job = s.createNewJob(fileName);
 
    // Do it
    var restoreReturn = false;
    try {
        restoreReturn = restoreMetadata(fileName, packedFilePath, job, s, verboseDebugging);
    } catch (e) {
        s.log(3, "Job could not have metadata restored " + e);
        return false  // Returning false here causes Portals to skip the file
        // File.remove(packedFilePath);  // removing the file will delete it
    }
    if(restoreReturn === false){
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

function timerFired( s : Switch )
{	
    // Get some variables
    var channel = normalizeChannelProperty(s, s.getPropertyValue("Channel"));
    var debug = s.getPropertyValue("Debug");
    var scope = normalizeChannelProperty(s, s.getPropertyValue("Scope"));
    var programId = normalizeChannelProperty(s, s.getPropertyValue("ProgramId"));
    var flow = s.getFlowName();

    // Create ether path from ScriptData folder
    var etherName = 'SwitchPortalsEther';
    var scriptDataFolder = s.getSpecialFolderPath('ScriptData');
    var etherPath = scriptDataFolder + getDirectorySeperator(s) + etherName;

    // Debugging
    var verboseDebugging = false;
    if(debug === "Yes"){
        verboseDebugging = true;
    }

	// Determine channel from properties
    var channelKey = getChannelKey(s, flow, scope, channel, programId);
    var channelFolder = etherPath + getDirectorySeperator(s) + channelKey + getDirectorySeperator(s);
    var tempFolder = channelFolder + getDirectorySeperator(s) + "temp" + getDirectorySeperator(s);

    // Set the timerInterval on start
    if (s.getTimerInterval() == 0){
        s.setTimerInterval(10);
    }

    // Debug
	if(verboseDebugging === true){
	    s.log(-1, "Channel folder: "+channelFolder);
	}

    // Look for files in the channel
	var dir = new Dir(channelFolder);
	var packedChannelJobs = dir.entryList("*", Dir.Files, Dir.Name);

    if(packedChannelJobs.length > 0){

		if(verboseDebugging === true){
			s.log(-1, "Files found: "+packedChannelJobs.length);
		}
				
	    // Insert each job found
		forEach(packedChannelJobs, function(fileName, i){
			if(verboseDebugging === true){
				s.log(-1, "Picking up file " + i + ": " + fileName);
			}
			
			var packedFilePath = channelFolder + fileName;
			
			var unpackReturn = unpackJob(s, packedFilePath, fileName, tempFolder, verboseDebugging);			

			if(unpackReturn === false){
				s.log(2, "unpackJob returned false. Could not unpack. Skipping this file.");
			} else {
				 job = unpackReturn.job;
				 unpackDestination = unpackReturn.unpackDestination;
				 oldFileName = unpackReturn.oldFileName;
				
				 contentPath = unpackDestination + getDirectorySeperator(s) + "contents"+ getDirectorySeperator(s) + oldFileName;
				
				if(verboseDebugging === true){
					s.log(-1, "contentPath: "+contentPath);
				}
				
				job.sendToSingle(contentPath);
			}
		});	
    }
	
	return;
}