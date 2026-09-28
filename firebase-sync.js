(() => {
  "use strict";

  const config = window.COLEARN_FIREBASE_CONFIG || {};
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const configured = required.every((key) => typeof config[key] === "string" && config[key].trim());
  let auth;
  let progressRef;
  let progressRefUid = null;
  let stopProgressWatch = null;

  function initialize(onUser) {
    if (!configured) return { configured: false };
    if (!window.firebase?.initializeApp || !window.firebase.auth || !window.firebase.firestore) {
      throw new Error("Không tải được Firebase SDK. Hãy kiểm tra kết nối Internet rồi tải lại trang.");
    }
    const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(config);
    auth = app.auth();
    auth.onAuthStateChanged((user) => onUser(user || null));
    return { configured: true };
  }

  async function signIn() {
    if (!configured || !auth) throw new Error("Firebase chưa được cấu hình.");
    const provider = new window.firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  }

  async function signOut() {
    if (auth) await auth.signOut();
  }

  function getProgressRef() {
    const user = auth?.currentUser;
    if (!user) throw new Error("Bạn chưa đăng nhập.");
    if (!progressRef || progressRefUid !== user.uid) {
      progressRef = window.firebase.firestore().collection("users").doc(user.uid);
      progressRefUid = user.uid;
    }
    return progressRef;
  }

  async function loadProgress() {
    const snapshot = await getProgressRef().get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async function saveProgress(progress) {
    await getProgressRef().set({
      selectedDay: progress.selectedDay,
      learned: progress.learned,
      bookmarks: progress.bookmarks,
      readArticles: progress.readArticles,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  function watchProgress(onProgress, onError) {
    if (stopProgressWatch) stopProgressWatch();
    stopProgressWatch = getProgressRef().onSnapshot((snapshot) => {
      if (snapshot.exists) onProgress(snapshot.data());
    }, onError);
    return stopProgressWatch;
  }

  window.ColearnFirebase = { isConfigured: configured, initialize, signIn, signOut, loadProgress, saveProgress, watchProgress };
})();
