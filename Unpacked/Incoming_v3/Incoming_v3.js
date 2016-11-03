
// ---------- HELPER FUNCTIONS ---------- //

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

var normalizeChannelProperty = function(s : Switch, value){
	var re = /[^a-zA-Z0-9\-]/gi;
	var modified = value.replace(re, ""); // Replace
	return modified;
}

function isPropertyValid( s : Switch, tag : String, original : String )
{
    var modified = normalizeChannelProperty(s, original);

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
    //return directorySeperator;
	return "/";
};

var normalizePath = function( s : Switch, path) {
	//converted = Dir.convertSeparators( Dir.cleanDirPath( path ) );
	converted = Dir.cleanDirPath( path );
	s.log(2, "converting " + path + " to " +  converted);
	return converted;
}

// Checks to make sure an array of path segments exists.
// If not, it recursively creates the folder heirarchy.
var initDirectory = function(s, verboseDebugging, pathArray, key) {
	cwd = "";

	forEach(pathArray, function(pathSegment, i){
		cwd += pathSegment;
		dir = new Dir(cwd);

		if(!dir.exists){

			dir.cdUp();

			if(verboseDebugging === true){
				s.log(-1, "initDirectory: '" + dir.absPath + "' '"+pathSegment+"' did not exist. Creating it.");
			}

			try {
				dir.mkdir(pathSegment);

			} catch (e) {
				s.log(3, "Could not make '" + key + "'. " + e);
			}

		}

		cwd += getDirectorySeperator(s);

	});

	lastDir = new Dir(cwd);
	return lastDir.absPath;
}

// ---------- APPLICATION ---------- //

// Packing function
var packJob = function(s : Switch, job : Job, tempFolder, destinationPath, flow, scope, channel, programId, verboseDebugging){

    // Set some variables
	var packLocation = initDirectory(s, verboseDebugging, [tempFolder, job.getUniqueNamePrefix()], "pack location");
	var datasetDir = initDirectory(s, verboseDebugging, [packLocation, "datasets"], "dataset location", true);

    // Writing datasets
    var writeDatasets = function(){

        var datasetTags = job.getDatasetTags();

        if(datasetTags.length > 0){
			if(verboseDebugging === true){
				s.log(-1, datasetTags.length + " external datasets found.");
			}
        }

		// Replace with forEach
		forEach(datasetTags, function(tag) {

			if(verboseDebugging === true){
				s.log(-1, "Packing dataset: "+ tag);
			}

			dataset = job.getDataset(tag);

			if (dataset) {
				datasetPath = dataset.getPath();
				datasetModel = dataset.getModel();

				datasetDestination = datasetDir + getDirectorySeperator(s) + tag + "." + datasetModel;
				datasetCopyResult = s.copy(datasetPath, datasetDestination);

				if(!datasetCopyResult){
				   s.log(3, 'Could not copy dataset to temporary location: ' + datasetDestination);
				}
			} else {
				s.log(2, "Dataset '"+ tag + "' could not be retreived. Skipping.");
			}
		});

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
				forEach(privateDataTags, function(tag) {
					// Create it
					createElement(pdParent, doc, tag, job.getPrivateData(tag), true);
				});
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

       // Move job ticket
		var ticketPath = initDirectory(s, verboseDebugging, [packLocation, "jobTicket"], "job ticket location", true);
		var ticketDestination = ticketPath + getDirectorySeperator(s) +  "ticket.xml";

		var ticketCopyResult = s.copy(jobTicketPath, ticketDestination);

		if(!ticketCopyResult){
		   s.log(3, 'Could not copy job ticket to temporary location: ' + ticketDestination);
		}
    };

    // Archive the job
    var archiveJob = function(){

        // Copy job to temp directory
        var jobTempPath = '';
		// Folders
		if(job.isFolder()){

			jobTempFolder = job.createPathWithName("contents", true);

			contentsDir = new Dir(jobTempFolder);
			try {
				contentsDir.mkdir(job.getName());
			} catch(e) {
				s.log(3, "Could not mkdir 'contents' in '"+ contentsDir +"' " + e);
			}

			jobTempPath = jobTempFolder + getDirectorySeperator(s) + job.getName();
		// Files
		} else {
			contentsDir = initDirectory(s, verboseDebugging, [packLocation, "contents"], "contents location", true);
			jobTempPath = contentsDir + getDirectorySeperator(s) + job.getName();
			jobTempFolder = contentsDir;
		}

       var copyResult = s.copy(job.getPath(), jobTempPath);

		if(verboseDebugging === true){
	        s.log(-1, "job.getPath(): " + job.getPath());
	        s.log(-1, "jobTempPath: " + jobTempPath);
	        s.log(-1, "copyResult: " + copyResult);
		}

	   if(!copyResult) {
		   s.log(3, "Job failed to copy to the temporary archive location.");
		   return false;
	   }

		// Archive
		var password = '';
		var compress = false;
		var removeExisting = false;
		var packDestination = destinationPath + ".zip";

		var assetArchiveSuccess = s.archive(jobTempFolder, packDestination, password, compress, removeExisting);
		var datasetArchiveSuccess = s.archive(packLocation + getDirectorySeperator(s) + "datasets", packDestination, password, compress, removeExisting);
		var ticketArchiveSuccess = s.archive(packLocation + getDirectorySeperator(s) + "jobTicket", packDestination, password, compress, removeExisting);

		if (verboseDebugging === true){
	        s.log(-1, "Archive saved to: " + packDestination);
	        s.log(-1, "assetArchiveSuccess: " + assetArchiveSuccess +
				  		" datasetArchiveSuccess: "+ datasetArchiveSuccess +
				  		" ticketArchiveSuccess: " + ticketArchiveSuccess);
		}
        return assetArchiveSuccess;
    };

    // Do it
    writeDatasets();
    writeJobTicket();
    var archiveResult = archiveJob();

	if(!archiveResult){
		return false;
	} else {
		return packLocation;
	}
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
    //var etherPath = scriptDataFolder + getDirectorySeperator(s) + etherName;

    // Debugging
    var verboseDebugging = false;
    if(debug === "Yes"){
        verboseDebugging = true;
    }

	// Declare some stuff
    var completeFilename = "_" + job.getUniqueNamePrefix() + "_" + job.getName();
    var channelKey = getChannelKey(s, flow, scope, channel, programId);

    // Setup folders
	var etherPath = initDirectory(s, verboseDebugging, [scriptDataFolder, etherName], "ether folder");
	var channelFolder = initDirectory(s, verboseDebugging, [etherPath, channelKey], "channel folder");
	var tempFolder = initDirectory(s, verboseDebugging, [channelFolder, "temp"], "temp channel folder");

	var destinationPath = channelFolder +  getDirectorySeperator(s) + completeFilename;

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
	}

    // Pack the job and move it
    var tempPackLocation = packJob(s, job, tempFolder, destinationPath, flow, scope, channel, programId, verboseDebugging);

	if(tempPackLocation) {

		// Remove the temporarily packed job
		var tempPackDir = new Dir(tempPackLocation);
		try {
			tempPackDir.rmdirs();
		} catch (e) {
			s.log(3, "Could not delete the temporay packed job. " + e);
		}

		// Remove this job from Switch
		job.sendToNull(job.getPath());

	}

	return;
}
