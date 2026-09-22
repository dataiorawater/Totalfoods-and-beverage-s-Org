
export const onAuthChange = (callback: (user: any, token: string | null) => void) => {
  callback({ email: 'staff@app.com', name: 'Staff' }, 'GAS_MODE_TOKEN');
  return () => {};
};

export const googleSignIn = async () => {
  return { user: { email: 'staff@app.com', displayName: 'Staff' }, accessToken: 'GAS_MODE_TOKEN' };
};

export const getAccessToken = async (): Promise<string | null> => {
  return 'GAS_MODE_TOKEN';
};

export const logoutGoogle = async () => {
  localStorage.removeItem('app_user_login');
  window.location.reload();
};
