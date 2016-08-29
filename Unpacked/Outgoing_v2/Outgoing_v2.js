var normalizeChannelProperty = function(s : Switch, value){
	var re = /[^a-zA-Z0-9\-]/gi;

    var modified = value.replace(re, ""); // Replace

	return modified;
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

function timerFired( s : Switch )
{
    // Determine directory seperator
    var getDirectorySeperator = function(){
        var directorySeperator;
        if(s.isMac()){
            directorySeperator = '/';
        } else {
            directorySeperator = '\\'
        }

        return directorySeperator;
    };

    var getChannelKey = function(scope, channel, programId){
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

    // Get some variables
    var channel = normalizeChannelProperty(s, s.getPropertyValue("Channel"));
    var debug = s.getPropertyValue("Debug");
    var scope = normalizeChannelProperty(s, s.getPropertyValue("Scope"));
    var programId = normalizeChannelProperty(s, s.getPropertyValue("ProgramId"));
    var flow = s.getFlowName();

    // Create ether path from ScriptData folder
    var etherName = 'SwitchPortalsEther';
    var scriptDataFolder = s.getSpecialFolderPath('ScriptData');
    var etherPath = scriptDataFolder + getDirectorySeperator() + etherName;

    // Debugging
    var logLevel = -1;
    if(debug === "Yes"){
        logLevel = 2;
    }

	// Stop looping errors
	var fatalJobCleaner = function( s : Switch, job: job, filePath )
	{
		s.log(3, "Fatal exception occured. Deleting incoming job to prevent looping errors. Contact the Portals dev.");
		var filePath = channelFolder+fn;
		var file = new File(filePath);
		file.remove(); // Not working, permissions
	}

    // Unpacking function
    var unpackJob = function(filePath){

        // Unzip
        var unarchive = function(job){

            var unpackDestination = job.createPathWithName("unarchiveTemp", true);

            s.unarchive(filePath, unpackDestination);

            return unpackDestination;
        };

        // Restore datasets
        var restoreDatasets = function(job, datasetsLocation){
            var datasetsDir = new Dir(datasetsLocation);

            var entries = datasetsDir.entryList("*", Dir.Files, Dir.Name);

            // Insert each file found
            for (i=0; i < entries.length; i++) {
                fn = entries[i];

                model = fn.substring(fn.length - 3);
                datasetTag = fn.substring(0, (fn.length - 4))

                sourceDatasetPath = datasetsLocation + getDirectorySeperator() + fn;

                s.log(logLevel, model + " dataset found: "+ datasetTag);

                dataset = job.createDataset(model);
                datasetBacking = dataset.getPath();

                // Overwrite backing file with source dataset
                s.copy(sourceDatasetPath, datasetBacking);
                job.setDataset(datasetTag, dataset);
            }

            return job;
        };

		var restoreJobTicket = function(job : Job, jobTicketLocation, s){

			// Helper function
			var splitString = function(string, delimeter){
				var array = string.split(delimeter);
				return array;
			}

		   jobTicketPath = jobTicketLocation + getDirectorySeperator() + 'ticket.xml';

			//jobTicketPath = '/Users/dominickpeluso/Desktop/ticket.xml';

			var doc = new Document(jobTicketPath);
			if(!doc.isWellFormed()){
				job.fail("Job ticket could not be restored and the job could not be processed.");
				fatalJobCleaner(s, job, filePath); // Kill the failure
			}
			var docChildren = doc.getChildNodes();
			var jobTicketNode = docChildren.getItem(0);

			var children = jobTicketNode.getChildNodes();

			var i, node, key, value, textNode, oldUniqueNamePrefix, oldName;
			for(i = 0; i < children.getCount();i++){//getCount() == length

				node = children.getItem(i);

				key = node.getBaseName();

				if(key !== 'getPrivateData'){
					// Standard job ticket field
					textNode = node.getFirstChild();
					if(textNode){
						value = textNode.getValue();

						// Log
						s.log(logLevel, 'Restoring job ticket part - ' + key + ': ' + value);

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
					s.log(logLevel, "Found private data");

					pdChildren = node.getChildNodes();

					// For each PD
					for(index = 0; index < pdChildren.getCount();index++){

						pdNode = pdChildren.getItem(index);
						key = pdNode.getAttributeValue('key');

						s.log(logLevel, "Restoring PD key: "+key);

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

        var restoreMetadata = function(){

            var job = s.createNewJob();
            var unpackDestination	= unarchive(job);
            contentsLocation = unpackDestination + getDirectorySeperator() + "contents";
            datasetsLocation = unpackDestination + getDirectorySeperator() + "datasets";
            jobTicketLocation = unpackDestination + getDirectorySeperator() + "jobTicket";

            s.log(logLevel, "unpackDestination: "+unpackDestination);
            s.log(logLevel, "contentsLocation: "+contentsLocation);

            job = restoreDatasets(job, datasetsLocation);

            jobTicketRestoreReturn = restoreJobTicket(job, jobTicketLocation, s);

            job = jobTicketRestoreReturn.job;

            restoreReturn = {
                job: job,
                unpackDestination: unpackDestination,
                oldUniqueNamePrefix: jobTicketRestoreReturn.oldUniqueNamePrefix,
                oldFileName: jobTicketRestoreReturn.oldFileName
            };

            return restoreReturn;
        };

        // Do it
        var restoreReturn = restoreMetadata();

        // Remove the archive
        File.remove(filePath);

        return restoreReturn;
    };

	// Determine channel from properties
    var channelKey = getChannelKey(scope, channel, programId);

    var channelFolder = etherPath + getDirectorySeperator() + channelKey + getDirectorySeperator();
    //var channelFolder = "/Users/dominickpeluso/Desktop/Test Folder/SwitchPortalsEther/C/";

    var tempFolder = channelFolder + getDirectorySeperator() + "temp" + getDirectorySeperator();

    // Set the timerInterval on start
    if (s.getTimerInterval() == 0){
        s.setTimerInterval(20);
    }

    // Debug
    s.log(logLevel, "Channel folder: "+channelFolder);

    // Look for files in the channel
    var dir = new Dir(channelFolder);
    var entries = dir.entryList("*", Dir.Files, Dir.Name);
    if(entries.length > 0){
        s.log(logLevel, "Files found: "+entries.length);
    }

    // Insert each file found
    for (var i=0; i < entries.length; i++) {
        var fn = entries[i];
        s.log(logLevel, "Picking up: "+fn);

        var filePath = channelFolder+fn;
        var unpackReturn = unpackJob(filePath, fn, tempFolder);
        var job = unpackReturn.job;
        var unpackDestination = unpackReturn.unpackDestination;
        var oldFileName = unpackReturn.oldFileName;

        var contentPath = unpackDestination + getDirectorySeperator() + "contents"+ getDirectorySeperator() + oldFileName;

        s.log(logLevel, "contentPath: "+contentPath);

        job.sendToSingle(contentPath);
    }


}
