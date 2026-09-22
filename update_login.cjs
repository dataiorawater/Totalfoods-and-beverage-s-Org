const fs = require('fs');

// --- 1. LoginScreen.tsx ---
let loginCode = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');

const newInterface = `interface LoginScreenProps {
  staffList: StaffUser[];
  onLoginAttempt: (email: string, pass: string) => Promise<{success: boolean, message?: string}>;
  onUpdatePassword?: (email: string, newPassword: string) => Promise<boolean>;
  sheetsConnected: boolean;
}`;

loginCode = loginCode.replace(/interface LoginScreenProps \{[\s\S]*?\}\n/m, newInterface + '\n');
loginCode = loginCode.replace(/onLoginSuccess,/g, 'onLoginAttempt,');

const newSignIn = `  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('กรุณากรอกอีเมล');
      return;
    }
    
    setIsSaving(true);
    const res = await onLoginAttempt(cleanEmail, passwordInput);
    setIsSaving(false);
    
    if (res.success) {
      setSuccessMessage('เข้าสู่ระบบสำเร็จ...');
    } else {
      setErrorMessage(res.message || 'รหัสผ่านไม่ถูกต้อง');
    }
  };`;

loginCode = loginCode.replace(/  const handleEmailSignIn = \(e: React\.FormEvent\) => \{[\s\S]*?  \};\n/m, newSignIn + '\n');

// Also update handleSaveNewPassword's success call:
loginCode = loginCode.replace(/onLoginSuccess\(\{ \.\.\.matchedUser, password: passwordInput \}, false\);/g, 'onLoginAttempt(matchedUser.email, passwordInput);');

fs.writeFileSync('src/components/LoginScreen.tsx', loginCode);

// --- 2. App.tsx ---
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

appCode = appCode.replace(/  const handleLoginSuccess = async \(user: StaffUser[\s\S]*?    \}\);\n  \};\n/m, newLoginAttempt + '\n');

// Update LoginScreen props in App.tsx
appCode = appCode.replace(/<LoginScreen[\s\S]*?\/>/m, `<LoginScreen
          staffList={staffList}
          onLoginAttempt={handleLoginAttempt}
          onUpdatePassword={handleUpdateUserPassword}
          sheetsConnected={!!sheetsConfig?.spreadsheetId}
        />`);

fs.writeFileSync('src/App.tsx', appCode);

