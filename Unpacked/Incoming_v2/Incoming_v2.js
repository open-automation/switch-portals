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



function jobArrived( s : Switch, job : Job )
{

/*

*/

	// Write channel and flow details to job ticket

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


    // Gather some variables
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

    // Packing function
    var packJob = function(tempFolder, destinationPath){

        // Set some variables
        var packLocation = tempFolder + getDirectorySeperator() + job.getUniqueNamePrefix();

        // Writing datasets
        var writeDatasets = function(){

            var datasetTags = job.getDatasetTags();

            if(datasetTags.length > 0){
                s.log(logLevel, datasetTags.length + " external datasets found.");
            }

            for (i=0; i < datasetTags.length; i++) {
                tag = datasetTags[i];

                s.log(logLevel, "Packing dataset: "+ tag);

                dataset = job.getDataset(tag);
                datasetPath = dataset.getPath();
                datasetModel = dataset.getModel();

                // Copy datasets to temp location
                datasetDestination = 	packLocation + getDirectorySeperator()
                    + "datasets" + getDirectorySeperator()
                    + tag + "." + datasetModel;

                s.copy(datasetPath, datasetDestination);
            }

        };

        // Writing job ticket
        var writeJobTicket = function(){

			// XML helper function
			var createElement = function(parent, doc, key, value, attributeAsKey){

				if(typeof(attributeAsKey) == 'undefined'){
					attributeAsKey = false;
				}

				var parentLength, index, child;
				parentLength = parent.getChildNodes().length;
				index = 'Key'+parentLength;

				//s.log(2, "parentLength: "+parentLength);

				if(attributeAsKey == true){
					child = doc.createElement(index, null);
				} else {
					child = doc.createElement(key, null);
				}

				// Set (sometimes) redundant key
				child.addAttribute("key", null, key);

				parent.appendChild(child);

				if(value){
					text = doc.createText( value );
					child.appendChild(text);
				}

				return child;
			}

            var getPrivateData = function(parent, doc){
                var privateDataTags = job.getPrivateDataTags();

				  // Make parent PD node
				  var pdParent =  createElement(parent, doc, 'getPrivateData', null);

                if(privateDataTags.length > 0){
                    s.log(logLevel, privateDataTags.length + " private data tags found.");

                    for (i=0; i < privateDataTags.length; i++) {
                       	tag = privateDataTags[i];
							// Create it
							createElement(pdParent, doc, tag, job.getPrivateData(tag), true);
                    }
                }

                return true;
            }

			// Write XML job ticket
			var doc = new Document();
			var root = doc.createElement("JobTicket");
			doc.setDocumentElement(root);

			createElement(root, doc, "getHierarchyPath", job.getHierarchyPath());
			createElement(root, doc, "getEmailAddresses", job.getEmailAddresses());
			createElement(root, doc, "getEmailBody", job.getEmailBody());
			createElement(root, doc, "getJobState", job.getJobState());
			createElement(root, doc, "getUserName", job.getUserName());
			createElement(root, doc, "getUserFullName", job.getUserFullName());
			createElement(root, doc, "getUserEmail", job.getUserEmail());
			createElement(root, doc, "getPriority", job.getPriority());
			createElement(root, doc, "getArrivalStamp", job.getArrivalStamp());
			createElement(root, doc, "getName", job.getName());
			createElement(root, doc, "getUniqueNamePrefix", job.getUniqueNamePrefix());
			createElement(root, doc, "getExtension", job.getExtension());

			// Do private data
			getPrivateData(root, doc);

			// Save some Portal-specific stuff
			var portals = doc.createElement("SourcePortal");
			doc.setDocumentElement(root);

			createElement(portals, doc, "getFlowName", s.getFlowName());
			createElement(portals, doc, "getChannelKey", getChannelKey(scope, channel, programId));
			createElement(portals, doc, "getScope", scope);
			createElement(portals, doc, "getChannel", channel);
			createElement(portals, doc, "getProgramId", programId);
			createElement(portals, doc, "getElementName", s.getElementName() );

			// Save XML as file
			var jobTicketPath = job.createPathWithName("ticket.xml");

			doc.save(jobTicketPath);

			s.log(logLevel, "Job ticket written to: " + jobTicketPath);

           // move job ticket
           var ticketDestination = packLocation + getDirectorySeperator()
                + "jobTicket" + getDirectorySeperator()
                + "ticket.xml";
            s.copy(jobTicketPath, ticketDestination);
        };

        // Archive the job
        var archiveJob = function(){

            // Copy job to temp directory
            var jobTempPath = '';
            if(job.isFolder()){

                jobTempFolder = job.createPathWithName("contents", true);

                contentsDir = new Dir(jobTempFolder);
                contentsDir.mkdir(job.getName());

                jobTempPath = jobTempFolder + getDirectorySeperator() + job.getName();


            } else {
                jobTempPath = packLocation + getDirectorySeperator()
                    + "contents" + getDirectorySeperator()
                    + job.getName();
                jobTempFolder = packLocation + getDirectorySeperator()
                    + "contents";
            }

            var copyResult = s.copy(job.getPath(), jobTempPath);

            s.log(logLevel, "job.getPath(): " + job.getPath());
            s.log(logLevel, "jobTempPath: " + jobTempPath);
            s.log(logLevel, "copyResult: " + copyResult);

            // Archive
            var password = '';
            var compress = false;
            var removeExisting = false;
            var packDestination = destinationPath + ".zip";

            var archiveSuccess = s.archive(jobTempFolder, packDestination, password, compress, removeExisting);
            var archiveSuccess = s.archive(packLocation + getDirectorySeperator() + "datasets", packDestination, password, compress, removeExisting);
            var archiveSuccess = s.archive(packLocation + getDirectorySeperator() + "jobTicket", packDestination, password, compress, removeExisting);

            s.log(logLevel, "Archive saved to: " + destinationPath);

            return archiveSuccess;
        };

        // Do it
        writeDatasets();
        writeJobTicket();
        var archiveResult = archiveJob();

        return packLocation;

    };

    var completeFilename = "_" + job.getUniqueNamePrefix() + "_" + job.getName();

    var channelKey = getChannelKey(scope, channel, programId);

    var channelFolder = etherPath + getDirectorySeperator()
        + channelKey + getDirectorySeperator();

    var tempFolder = etherPath + getDirectorySeperator()
        + channelKey + getDirectorySeperator()
        + "temp" + getDirectorySeperator();

    var destinationPath = channelFolder + completeFilename;

    // Debugging
    s.log(logLevel, "etherPath: "+etherPath);
    s.log(logLevel, "scriptDataFolder: "+scriptDataFolder);
    s.log(logLevel, "scope: "+scope);
    s.log(logLevel, "completeFilename: "+completeFilename);
    s.log(logLevel, "channelKey: "+channelKey);
    s.log(logLevel, "channelFolder: "+channelFolder);
    s.log(logLevel, "tempFolder: "+tempFolder);
    s.log(logLevel, "completeFilename: "+completeFilename);
    s.log(logLevel, "destinationPath: "+destinationPath);

    // Setup folders
    var scriptDataDir = new Dir(scriptDataFolder);
    var etherDir = new Dir(etherPath);
    var channelDir = new Dir(channelFolder);

    // Debugging
    s.log(logLevel, "etherDir: "+etherDir);
    s.log(logLevel, "channelDir: "+channelDir);

    // Create ether folder if it doesn't exist
    if(!etherDir.exists){
        scriptDataDir.mkdir(etherName);
        s.log(logLevel, "Ether folder did not exist. Creating it.");
    }

    // Create channel folder if it doesn't exist
    if(!channelDir.exists){
        etherDir.mkdir(channelKey);
        s.log(logLevel, "Channel folder did not exist. Creating it.");
    }

    // Pack the job and move it
    var tempPackLocation = packJob(tempFolder, destinationPath);

    // Remove the temporarily packed job
    var tempPackDir = new Dir(tempPackLocation);
    tempPackDir.rmdirs();

    // Remove this job from Switch
    job.sendToNull(job.getPath());

}
