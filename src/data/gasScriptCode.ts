export const GOOGLE_APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return response({ status: "ok", message: "GAS Backend is active" });
    }
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    
    if (action === "ping") {
      return response({ status: "ok", message: "GAS connection successful" });
    }

    // Google Drive Store Photo Upload
    if (action === "uploadDrivePhoto") {
      const parentFolderId = payload.parentFolderId || "1OMgGdY7DM78UviFNLJ-Wi_t_ayjsH5V4";
      const rawStoreName = String(payload.storeName || "ร้านค้าใหม่")
        .trim()
        .replace(/[\\\\/:*?"<>|]+/g, " ")
        .replace(/\\s+/g, " ")
        .trim();
      const storeName = rawStoreName || "ร้านค้าใหม่";
      const slotNumber = payload.slotNumber || 1;
      const base64Data = payload.base64Data;
      const mimeType = payload.mimeType || "image/jpeg";

      if (!base64Data) {
        return response({ error: "Missing base64Data" }, 400);
      }

      const parentFolder = DriveApp.getFolderById(parentFolderId);
      const subFolders = parentFolder.getFoldersByName(storeName);
      const storeFolder = subFolders.hasNext()
        ? subFolders.next()
        : parentFolder.createFolder(storeName);

      const fileName = storeName + " รูปที่ " + slotNumber + ".jpg";
      const bytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const file = storeFolder.createFile(blob);

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (permErr) {}

      const fileId = file.getId();
      return response({
        success: true,
        fileId: fileId,
        fileName: file.getName(),
        folderId: storeFolder.getId(),
        folderName: storeFolder.getName(),
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
  return response({ status: "ok", message: "GAS Backend is running successfully v3 (Sheets + Drive)" });
}
`;
