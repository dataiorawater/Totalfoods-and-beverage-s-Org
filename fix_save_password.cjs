const fs = require('fs');

let loginCode = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');

const newSavePass = `  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('กรุณากรอกอีเมล');
      return;
    }
    
    if (passwordInput.length < 4) {
      setErrorMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    setIsSaving(true);
    
    try {
      // First try to login to fetch the user (which also fetches the latest list)
      const res = await onLoginAttempt(cleanEmail, '');
      
      // If it says it doesn't have a password, we can proceed
      if (res.message && res.message.includes('ยังไม่ได้ตั้งรหัสผ่าน')) {
        if (onUpdatePassword) {
          const success = await onUpdatePassword(cleanEmail, passwordInput);
          if (success) {
            setSuccessMessage('ตั้งรหัสผ่านเรียบร้อย เข้าสู่ระบบได้เลย...');
            setTimeout(() => {
               onLoginAttempt(cleanEmail, passwordInput);
            }, 800);
          } else {
            setErrorMessage('ไม่สามารถบันทึกรหัสผ่านได้');
          }
        }
      } else if (res.message && res.message.includes('ไม่พบอีเมล')) {
         setErrorMessage(\`ไม่พบอีเมล "\${cleanEmail}" ในระบบ\`);
      } else if (res.message && res.message.includes('บัญชีนี้ถูกระงับ')) {
         setErrorMessage(res.message);
      } else {
         setErrorMessage('บัญชีนี้ตั้งรหัสผ่านไปแล้ว หากต้องการรีเซ็ตกรุณาติดต่อแอดมิน');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };`;

loginCode = loginCode.replace(/  const handleSaveNewPassword = async \(e: React\.FormEvent\) => \{[\s\S]*?  \};\n/m, newSavePass + '\n');
fs.writeFileSync('src/components/LoginScreen.tsx', loginCode);

