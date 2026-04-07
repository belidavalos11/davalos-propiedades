// Firebase Configuration - Replace with your actual config from Firebase Console
// Go to Project Settings -> General -> Your apps -> Web apps
const firebaseConfig = {
  apiKey: "AIzaSyDPGbevUGWbV37d88OcNjZpIhA2nOJggaA",
  authDomain: "davalos-propiedades.firebaseapp.com",
  projectId: "davalos-propiedades",
  storageBucket: "davalos-propiedades.firebasestorage.app",
  messagingSenderId: "15459885276",
  appId: "1:15459885276:web:7f45c3a32f08166c1f5419",
  measurementId: "G-1T036QHJG4"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.storage = firebase.storage();
    console.log("Firebase initialized");
} else {
    console.warn("Firebase SDK not loaded yet. Ensure scripts are included correctly.");
}
