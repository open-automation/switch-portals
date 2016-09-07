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

// Packing function
var packJob = function(s : Switch, job : Job, tempFolder, destinationPath, flow, scope, channel, programId, verboseDebugging){

    // Set some variables
    var packLocation = tempFolder + getDirectorySeperator(s) + job.getUniqueNamePrefix();

    // Writing datasets
    var writeDatasets = function(){

        var datasetTags = job.getDatasetTags();

        if(datasetTags.length > 0){
			if(verboseDebugging === true){
				s.log(-1, datasetTags.length + " external datasets found.");
			}
        }

		// Replace with forEach
        for (i=0; i < datasetTags.length; i++) {
			tag = datasetTags[i];

			if(verboseDebugging === true){
				s.log(-1, "Packing dataset: "+ tag);
			}

			dataset = job.getDataset(tag);
			datasetPath = dataset.getPath();
			datasetModel = dataset.getModel();

			// Copy datasets to temp location
			datasetDestination = 	packLocation + getDirectorySeperator(s)
			    + "datasets" + getDirectorySeperator(s)
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
				if(verboseDebugging === true){
					s.log(-1, privateDataTags.length + " private data tags found.");
				}
				// Replace with forEach
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
		createElement(portals, doc, "getChannelKey", getChannelKey(s, flow, scope, channel, programId));
		createElement(portals, doc, "getScope", scope);
		createElement(portals, doc, "getChannel", channel);
		createElement(portals, doc, "getProgramId", programId);
		createElement(portals, doc, "getElementName", s.getElementName() );
		createElement(portals, doc, "getPortalInDate", new Date().toString() );

		// Save XML as file
		var jobTicketPath = job.createPathWithName("ticket.xml");

		doc.save(jobTicketPath);

		if(verboseDebugging === true){
			s.log(-1, "Job ticket written to: " + jobTicketPath);
		}

       // move job ticket
       var ticketDestination = packLocation + getDirectorySeperator(s)
            + "jobTicket" + getDirectorySeperator(s)
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

            jobTempPath = jobTempFolder + getDirectorySeperator(s) + job.getName();

        } else {
            jobTempPath = packLocation + getDirectorySeperator(s)
                + "contents" + getDirectorySeperator(s)
                + job.getName();
            jobTempFolder = packLocation + getDirectorySeperator(s)
                + "contents";
        }

        var copyResult = s.copy(job.getPath(), jobTempPath);

		if(verboseDebugging === true){
	        s.log(-1, "job.getPath(): " + job.getPath());
	        s.log(-1, "jobTempPath: " + jobTempPath);
	        s.log(-1, "copyResult: " + copyResult);
		}

        // Archive
        var password = '';
        var compress = false;
        var removeExisting = false;
        var packDestination = destinationPath + ".zip";

        var archiveSuccess = s.archive(jobTempFolder, packDestination, password, compress, removeExisting);
        var archiveSuccess = s.archive(packLocation + getDirectorySeperator(s) + "datasets", packDestination, password, compress, removeExisting);
        var archiveSuccess = s.archive(packLocation + getDirectorySeperator(s) + "jobTicket", packDestination, password, compress, removeExisting);

		if(verboseDebugging === true){
	        s.log(-1, "Archive saved to: " + destinationPath);
		}

        return archiveSuccess;
    };

    // Do it
    writeDatasets();
    writeJobTicket();
    var archiveResult = archiveJob();

    return packLocation;

};

function jobArrived( s : Switch, job : Job )
{
    // Gather some variables
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

	// Declare some stuff
    var completeFilename = "_" + job.getUniqueNamePrefix() + "_" + job.getName();

    var channelKey = getChannelKey(s, flow, scope, channel, programId);

    var channelFolder = etherPath + getDirectorySeperator(s)
        + channelKey + getDirectorySeperator(s);

    var tempFolder = etherPath + getDirectorySeperator(s)
        + channelKey + getDirectorySeperator(s)
        + "temp" + getDirectorySeperator(s);

    var destinationPath = channelFolder + completeFilename;

    // Setup folders
    var scriptDataDir = new Dir(scriptDataFolder);
    var etherDir = new Dir(etherPath);
    var channelDir = new Dir(channelFolder);

	// Debugging
	if(verboseDebugging === true){
		s.log(-1, "etherPath: "+etherPath);
		s.log(-1, "scriptDataFolder: "+scriptDataFolder);
		s.log(-1, "scope: "+scope);
		s.log(-1, "completeFilename: "+completeFilename);
		s.log(-1, "channelKey: "+channelKey);
		s.log(-1, "channelFolder: "+channelFolder);
		s.log(-1, "tempFolder: "+tempFolder);
		s.log(-1, "completeFilename: "+completeFilename);
		s.log(-1, "destinationPath: "+destinationPath);
		s.log(-1, "etherDir: "+etherDir);
		s.log(-1, "channelDir: "+channelDir);
	}

    // Create ether folder if it doesn't exist
    if(!etherDir.exists){
        scriptDataDir.mkdir(etherName);
		if(verboseDebugging === true){
			s.log(-1, "Ether folder did not exist. Creating it.");
		}
    }

    // Create channel folder if it doesn't exist
    if(!channelDir.exists){
		etherDir.mkdir(channelKey);
		if(verboseDebugging === true){
			s.log(-1, "Channel folder did not exist. Creating it.");
		}
    }

    // Pack the job and move it
    var tempPackLocation = packJob(s, job, tempFolder, destinationPath, flow, scope, channel, programId, verboseDebugging);

    // Remove the temporarily packed job
    var tempPackDir = new Dir(tempPackLocation);
    tempPackDir.rmdirs();

    // Remove this job from Switch
    job.sendToNull(job.getPath());

	return;
}
