export const GOOGLE_APPS_SCRIPT_MANIFEST = `{
  "timeZone": "Asia/Bangkok",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}`;

export const GOOGLE_APPS_SCRIPT_CODE = `// กดปุ่ม "เรียกใช้ (Run)" ที่ฟังก์ชันนี้ 1 ครั้ง เพื่อกดอนุญาตสิทธิ์ Google Drive & Sheets
function authorizeDrive() {
  const rootName = DriveApp.getRootFolder().getName();
  const ssName = SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getName() : "OK";
  Logger.log("Permission granted! Drive Root: " + rootName + " | Sheet: " + ssName);
  return { driveRoot: rootName, sheet: ssName };
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return response({ status: "ok", message: "GAS Backend is active" });
    }
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === "ping") {
      return response({ status: "ok", message: "GAS connection successful" });
    }

    // Helper: find or create a subfolder inside a Drive parent folder
    const getOrCreateSubFolder = (parent, name) => {
      const clean = String(name || "")
        .trim()
        .replace(/[\\\\/:*?"<>|\\r\\n]+/g, " ")
        .replace(/\\s+/g, " ")
        .trim();
      const targetName = clean || "อื่นๆ";
      const iter = parent.getFoldersByName(targetName);
      return iter.hasNext() ? iter.next() : parent.createFolder(targetName);
    };

    // Google Drive Folder Connection Test
    if (action === "testDriveFolder") {
      const folderId = String(payload.folderId || "").trim();
      if (!folderId) {
        return response({ error: "Missing folderId" }, 400);
      }
      try {
        const folder = DriveApp.getFolderById(folderId);
        return response({
          success: true,
          folderId: folder.getId(),
          folderName: folder.getName(),
          folderUrl: folder.getUrl()
        });
      } catch (folderErr) {
        return response({
          error: "ไม่สามารถเข้าถึงโฟลเดอร์ Google Drive ได้ กรุณาตรวจสอบ Folder ID หรือสิทธิ์เข้าถึงของบัญชี Google (" + folderErr.toString() + ")"
        }, 400);
      }
    }

    // Google Drive Photo Upload (Storefront & Check-in)
    if (action === "uploadDrivePhoto") {
      const parentFolderId = String(payload.parentFolderId || "1OMgGdY7DM78UviFNLJ-Wi_t_ayjsH5V4").trim();
      const category = payload.category === "checkin" ? "checkin" : "storefront";
      const rawStoreName = String(payload.storeName || "ร้านค้าใหม่")
        .trim()
        .replace(/[\\\\/:*?"<>|\\r\\n]+/g, " ")
        .replace(/\\s+/g, " ")
        .trim();
      const storeName = rawStoreName || "ร้านค้าใหม่";
      const slotNumber = payload.slotNumber || 1;
      const base64Data = payload.base64Data;
      const mimeType = payload.mimeType || "image/jpeg";

      if (!base64Data) {
        return response({ error: "Missing base64Data" }, 400);
      }

      let targetFolder = DriveApp.getFolderById(parentFolderId);
      let fileName = "";

      if (category === "checkin") {
        // Optional root subfolder when check-in folder is not separated yet
        if (payload.useCheckInRootSubfolder) {
          targetFolder = getOrCreateSubFolder(targetFolder, "รูปการเช็คอิน");
        }
        const subFolderName = String(payload.subFolderName || "").trim();
        if (subFolderName) {
          targetFolder = getOrCreateSubFolder(targetFolder, subFolderName);
        }
        const rawCustomName = String(payload.customFileName || "")
          .trim()
          .replace(/[\\\\/:*?"<>|\\r\\n]+/g, " ")
          .replace(/\\s+/g, " ")
          .trim();
        fileName = rawCustomName || (storeName + "_checkin.jpg");
      } else {
        targetFolder = getOrCreateSubFolder(targetFolder, storeName);
        const rawCustomName = String(payload.customFileName || "")
          .trim()
          .replace(/[\\\\/:*?"<>|\\r\\n]+/g, " ")
          .replace(/\\s+/g, " ")
          .trim();
        fileName = rawCustomName || (storeName + " รูปที่ " + slotNumber + ".jpg");
      }

      const bytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const file = targetFolder.createFile(blob);

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (permErr) {}

      const fileId = file.getId();
      return response({
        success: true,
        fileId: fileId,
        fileName: file.getName(),
        folderId: targetFolder.getId(),
        folderName: targetFolder.getName(),
        webViewLink: "https://drive.google.com/file/d/" + fileId + "/view"
      });
    }

    if (action === "deleteDrivePhoto") {
      const fileId = payload.fileId;
      if (!fileId) {
        return response({ error: "Missing fileId" }, 400);
      }
      try {
        DriveApp.getFileById(fileId).setTrashed(true);
      } catch (delErr) {}
      return response({ success: true });
    }

    const spreadsheetId = payload.spreadsheetId;
    if (!spreadsheetId) {
      return response({ error: "Missing spreadsheetId" }, 400);
    }
    
    // Open the spreadsheet
    const ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (action === "getAllData") {
      const sheets = ss.getSheets();
      const result = {};
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i];
        result[s.getName()] = { values: s.getDataRange().getValues() };
      }
      return response(result);
    }

    const sheetName = payload.sheet;
    let sheet;
    
    if (sheetName) {
      sheet = ss.getSheetByName(sheetName);
    }
    
    if (action === "getData") {
      if (!sheet) return response({ error: "Sheet not found: " + sheetName }, 404);
      const values = sheet.getDataRange().getValues();
      return response({ values: values });
    }
    else if (action === "addSheet") {
      if (!sheet) {
        ss.insertSheet(sheetName);
      }
      return response({ success: true });
    }
    else if (action === "appendRow") {
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      sheet.appendRow(payload.rowData);
      return response({ success: true });
    }
    else if (action === "appendRows") {
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
      }
      if (payload.rowsData && payload.rowsData.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, payload.rowsData.length, payload.rowsData[0].length).setValues(payload.rowsData);
      }
      return response({ success: true });
    }
    else if (action === "updateRows") {
      if (!sheet) return response({ error: "Sheet not found" }, 404);
      const rowIndices = payload.rowIndices; 
      if (rowIndices && rowIndices.length > 0) {
        const sorted = rowIndices.sort((a,b) => b - a);
        for (let idx of sorted) {
          try { sheet.deleteRow(idx); } catch(e) {}
        }
      }
      if (payload.rowsData && payload.rowsData.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, payload.rowsData.length, payload.rowsData[0].length).setValues(payload.rowsData);
      }
      return response({ success: true });
    }
    else if (action === "updateRow") {
      if (!sheet) return response({ error: "Sheet not found" }, 404);
      const rowIndex = payload.rowIndex;
      const rowData = payload.rowData;
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return response({ success: true });
    }
    else if (action === "deleteRow") {
      if (!sheet) return response({ error: "Sheet not found" }, 404);
      const rowIndex = payload.rowIndex;
      sheet.deleteRow(rowIndex);
      return response({ success: true });
    }
    
    return response({ error: "Invalid action" }, 400);
    
  } catch (error) {
    return response({ error: error.toString() }, 500);
  }
}

// Function to handle CORS Preflight requests for safety
function doOptions(e) {
  return response({ status: "ok" });
}

// Standardized response with JSON
function response(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Support GET requests for testing
function doGet(e) {
  return response({ status: "ok", message: "GAS Backend is running successfully v4 (Sheets + Drive Storefront & Check-in)" });
}
`;
