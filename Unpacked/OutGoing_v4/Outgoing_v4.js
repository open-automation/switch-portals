// --------- APPLICATION ---------//
function removeFile(s, filePath) {
	try {
		File.remove(filePath);
	} catch (e) {
		s.log(3, filePath + " job could not be removed. " + e);
	}
}

function getOldTicketNameProperties(s, job,  jobTicketLocation) {
	const jobTicketPath = jobTicketLocation + getDirectorySeperator(s) + "ticket.xml";
	const doc = new Document(jobTicketPath);
	const docChildren = doc.getChildNodes();
	const jobTicketNode = docChildren.getItem(0);
	const childNodes = jobTicketNode.getChildNodes();
	const oldTicketNameProperties = {};
	for (i = 0; i < childNodes.getCount(); i++) {
		const childNode = childNodes.getItem(i);
		const key = childNode.getBaseName();
		const textNode = childNode.getFirstChild();
		s.log(2, typeof textNode);
		if (textNode && key !== "getPrivateData") {
			const value = textNode.getValue();
			if (key === "getUniqueNamePrefix") {
				oldTicketNameProperties.uniqueNamePrefix = value;
			} else if (key === "getName") {
				oldTicketNameProperties.name = value;
			}
		}
	}
	return oldTicketNameProperties;
}

function restoreTicketPropertyFromNode(s, job, node, key) {
	if (key !== "getPrivateData") {
		const textNode = node.getFirstChild();
		if (textNode) {
			const value = textNode.getValue();
			debugLog(s, "Restoring job ticket part - " + key + ": " + value);
			if(key == "getJobState") job.setJobState(value);
			if(key == "getPriority") job.setPriority(value);
			if(key == "getEmailBody") job.setEmailBody(value);
			if(key == "getEmailAddresses") job.setEmailAddresses(value.split(","));
			if(key == "getUserEmail") job.setUserEmail(value);
			if(key == "getUserName") job.setUserName(value);
			if(key == "getUserFullName") job.setUserFullName(value);
			if(key == "getHierarchyPath") job.setHierarchyPath(value.split(","));
		}
	} else {
		debugLog(s,  "Found private data");
		pdChildren = node.getChildNodes();
		for(index = 0; index < pdChildren.getCount(); index++){
			pdNode = pdChildren.getItem(index);
			key = pdNode.getAttributeValue("key");
			textNode = pdNode.getFirstChild();
			if(textNode){
				value = textNode.getValue();
			}
			job.setPrivateData(key, value);
			debugLog(s,  "Restoring PD key: " + key + " = " + value);			
		}
	}
}

function isDocWellFormed(s, job, doc, jobTicketPath) {
	const docWellFormed = doc.isWellFormed();
	if (!docWellFormed) {
		const malformedTicket = File.read(jobTicketPath, "UTF-8");
		job.log(3, "Malformed ticket: " + malformedTicket);
		job.fail("Job ticket could not be restored and the job could not be processed.");
	}
	return docWellFormed; 
}

function doesJobTicketFileExists(s, job, jobTicketPath) {
	const jobTicketFile = new File(jobTicketPath);
	const jobTicketFileExists = jobTicketFile.exists;
	if (!jobTicketFileExists) {
		job.log(3, "Job ticket does not exist, and could not be restored");
	}
	return jobTicketFileExists;
}

function restoreJobPropertiesFromTicket(s, job, jobTicketLocation) {
	const jobTicketPath = jobTicketLocation + getDirectorySeperator(s) + "ticket.xml";
	if (!doesJobTicketFileExists(s, job, jobTicketPath)) {
		return false;
	}
	const doc = new Document(jobTicketPath);
	if (!isDocWellFormed(s, job, doc, jobTicketPath)) {
		job.log(3, "Job ticket is'nt well formed, and could not be read");
		return false;
	}
	const docChildren = doc.getChildNodes();
	const jobTicketNode = docChildren.getItem(0);
	const childNodes = jobTicketNode.getChildNodes();
	for (i = 0; i < childNodes.getCount(); i++) {
		const childNode = childNodes.getItem(i);
		const key = childNode.getBaseName()
		restoreTicketPropertyFromNode(s, job, childNode, key);
	}
	return true;
}

function forEach(array, callback) {
	for (i = 0; i < array.length; i++) {
		var currentValue = typeof array[i] === undefined ? null : array[i];
		callback(currentValue, i, array);
	}
}

function restoreJobDatasets(s, job, datasetsLocation) {
	const datasetsDir = new Dir(datasetsLocation);
	const datasetEntries = datasetsDir.entryList("*", Dir.Files, Dir.Name);
	forEach(datasetEntries, function(datasetFilename, i) {
		model = datasetFilename.substring(datasetFilename.length - 3);
		datasetTag = datasetFilename.substring(0, (datasetFilename.length - 4));
		if (model === "que") {
			model = "Opaque";
			datasetTag = datasetFilename.substring(0, (datasetFilename.length - 7));
		}
		sourceDatasetPath = datasetsLocation + getDirectorySeperator(s) + datasetFilename;
		debugLog(s, model + " dataset found: " + datasetTag);
		dataset = job.createDataset(model);
		if (dataset) {
			datasetBacking = dataset.getPath();
			datasetCopySuccess = s.copy(sourceDatasetPath, datasetBacking);
			job.setDataset(datasetTag, dataset);
		} else {
			s.log(3, model + " dataset (tag: " + datasetTag + ") could not be created.");
		}
	});
}

function unarchive(s, job, filePath) {
	const unpackDestination = job.createPathWithName("unarchiveTemp" + job.getUniqueNamePrefix(), true);
	const unarchiveSuccess = s.unarchive(filePath, unpackDestination);
	if (!unarchiveSuccess) {
		s.log(3, "Unarchiving of the job to the temporary folder was unsuccessful.");
		return false;
	}
	debugLog(s, "unarchive : Success");
	return unpackDestination;
}

function restoreMetadataAndGetNewJobInfo(s, job, fileName, filePath) {
	const unpackDestination = unarchive(s, job, filePath);
	if (unpackDestination === false) {
		return false;
	} else {
		const location = {
			datasets : unpackDestination + getDirectorySeperator(s) + "datasets",
			jobTicket : unpackDestination + getDirectorySeperator(s) + "jobTicket"
		};
		restoreJobDatasets(s, job, location.datasets);
		if (!restoreJobPropertiesFromTicket(s, job, location.jobTicket)){
			return false
		}
		const oldTicketNameProperties = getOldTicketNameProperties(s, job,  location.jobTicket); 
		return {
			job: job,
			unpackDestination: unpackDestination,
			oldUniqueNamePrefix: oldTicketNameProperties.uniqueNamePrefix,
			oldFileName: oldTicketNameProperties.name
		};
	}
}


function unpackJob(s, packedFilePath, fileName, tempFolder) {
	const job = s.createNewJob(fileName);
	const newJobInfo = restoreMetadataAndGetNewJobInfo(s, job, fileName, packedFilePath);
	if (!newJobInfo) {
		return false;
	} else {
		newJobInfo.contentPath = newJobInfo.unpackDestination + getDirectorySeperator(s) + "contents" + getDirectorySeperator(s) + newJobInfo.oldFileName;
		debugLog(s, "File " + fileName + " :  unpack job successfull ");
		return newJobInfo;
	}
}
// --------- APPLICATION ---------//


// --------- Helper ---------//
function isFilePathArrived(s, filePath) {
	const stableTime = s.getPropertyValue("stableTime") / 1000;
	const file = new File(filePath);
	const fileHasArrived = file.hasArrived(stableTime);
	const log = fileHasArrived ? "File is stable since " + stableTime + "s" : "File is not stable at the moment.";
	debugLog(s, log);
	return fileHasArrived;
}

function debugLog(s, message) {
	const debug = s.getPropertyValue("Debug") === "Yes";
	if (debug) {
		s.log(1, message);
	}
}

function getChannelKey(s, flow, scope, channel, programId) {
	const prefix = {
		portal: "Portals_",
		channel: "C-",
		flow: "F-",
		global: "G-",
		program: "P-"
	};
	const segmentSeperator = "_";
	var channelKey = prefix.portal;
	if (scope === "Global") {
		channelKey += prefix.channel + channel;
	} else if(scope === "Program") {
		channelKey += prefix.program + programId + segmentSeperator + prefix.channel + channel;
	} else {
		channelKey += prefix.flow + flow + segmentSeperator + prefix.channel + channel;
	}
	return channelKey;
}

function getDirectorySeperator(s) {
	return s.isMac() ? "/" : "\\";
}

function normalizeChannelProperty(s, value) {
	return value.replace(/[^a-zA-Z0-9\-]/gi, "");
}

function getChannelFolder(s) {
	const channel = normalizeChannelProperty(s, s.getPropertyValue("Channel"));
	const scope = normalizeChannelProperty(s, s.getPropertyValue("Scope"));
	const programId = normalizeChannelProperty(s, s.getPropertyValue("ProgramId"));
	const flow = s.getFlowName();
	const etherPath = s.getSpecialFolderPath("ScriptData") + getDirectorySeperator(s) + "SwitchPortalsEther";
	const channelKey = getChannelKey(s, flow, scope, channel, programId);
	const channelFolder = etherPath + getDirectorySeperator(s) + channelKey + getDirectorySeperator(s);
	debugLog(s, "Channel folder: " + channelFolder);
	return channelFolder;
}
// --------- Helper ---------//


// --------- MainFunction --------- //
function timerFired( s : Switch ) {
	const scanInterval = s.getPropertyValue("scanInterval");
	if (s.getTimerInterval() === 0) {
		s.setTimerInterval(scanInterval);
		debugLog(s, "Scan interval : " + scanInterval + "s")
	}
	const channelFolder = getChannelFolder(s);
	const tempFolder = channelFolder + getDirectorySeperator(s) + "temp" + getDirectorySeperator(s);
	debugLog(s, "Temp folder: " + tempFolder);
	const dir = new Dir(channelFolder);
	const packedChannelJobs = dir.entryList("*", Dir.Files, Dir.Name);
	debugLog(s, "Files found: " + packedChannelJobs.length);	
	for (var i = 0; i < packedChannelJobs.length; i++) {
		debugLog(s, "Picking up file " + (i + 1) + ": " + packedChannelJobs[i]);
		packedFilePath = channelFolder + packedChannelJobs[i];
		if (!isFilePathArrived(s, packedFilePath)) {
			s.log(2, packedChannelJobs[i] + " is not stable. Skipping this file" );
		} else { 
			unpackedJob = unpackJob(s, packedFilePath, packedChannelJobs[i], tempFolder);
			if (unpackedJob) {
					unpackedJob.job.sendToSingle(unpackedJob.contentPath);
					removeFile(s, packedFilePath);
					debugLog(s, "Job send to single from contentPath: " + unpackedJob.contentPath);
			} else {
				s.log(3, "unpackJob returned false. Could not unpack. Skipping this file. See previous message for further information");
			}
		}
	}
}