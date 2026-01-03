
// Bu servis Google Drive etkileşimlerini yönetir.
// CLIENT_ID ve API_KEY gereklidir.
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // Buraya Client ID gelmeli
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

let accessToken: string | null = null;

export const initDriveAuth = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) reject(response);
          accessToken = response.access_token;
          resolve(response.access_token);
        },
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

export const pickDriveFolder = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!accessToken) return reject("No access token");

    const view = new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.FOLDERS);
    view.setMimeTypes("application/vnd.google-apps.folder");
    view.setSelectableMimeTypes("application/vnd.google-apps.folder");

    const picker = new (window as any).google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(process.env.API_KEY) // Gemini anahtarı picker için de kullanılabilir (projede aktifse)
      .setCallback((data: any) => {
        if (data.action === (window as any).google.picker.Action.PICKED) {
          resolve(data.docs[0].id);
        }
      })
      .build();
    picker.setVisible(true);
  });
};

export const listFolderFiles = async (folderId: string, token: string) => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&key=${process.env.API_KEY}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await response.json();
  return data.files || [];
};

export const downloadDriveFile = async (fileId: string, token: string): Promise<string> => {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};
