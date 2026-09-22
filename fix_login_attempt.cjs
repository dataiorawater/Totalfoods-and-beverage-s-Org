const fs = require('fs');
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const newLoginAttempt = `
  const handleLoginAttempt = async (email: string, pass: string): Promise<{success: boolean, message?: string}> => {
    try {
      let latestUsers = staffList;
      if (sheetsConfig?.spreadsheetId) {
        latestUsers = await fetchUsersFromSheets(sheetsConfig.spreadsheetId);
        setStaffList(latestUsers);
      }
      
      const matchedUser = latestUsers.find(u => u.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (!matchedUser) {
        return { success: false, message: \`ไม่พบอีเมล "\${email}" ในระบบ\` };
      }
      if (!matchedUser.password) {
        return { success: false, message: 'บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาไปที่แท็บ "ตั้งรหัสผ่านใหม่"' };
      }
      if (String(matchedUser.password) !== String(pass)) {
        return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
      }
      if (matchedUser.status === 'inactive') {
        return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
      }

      const finalUser = { ...matchedUser, lastLogin: new Date().toISOString() };
      setCurrentUser(finalUser);
      setIsLoggedIn(true);
      return { success: true };
    } catch(err: any) {
      return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
    }
  };
`;

appCode = appCode.replace(/  const handleLoginSuccess = async \(user: StaffUser, isGoogle: boolean = false\) => \{[\s\S]*?console\.error\('Error fetching real user data during login:', err\);\n    \}\n  \};/m, newLoginAttempt.trim());

fs.writeFileSync('src/App.tsx', appCode);
