const admin = require("firebase-admin");
const { machineIdSync } = require("node-machine-id");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🆔 Device ID
function getDeviceId() {
    return machineIdSync();
}

// 🔑 التحقق من المفتاح
async function verifyKey(key) {

    const docRef = db.collection("activation_keys").doc(key);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { success: false, message: "❌ المفتاح غير صحيح" };
    }

    const data = doc.data();

    // ⛔ انتهاء الاشتراك
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
        return { success: false, message: "⛔ انتهت صلاحية الاشتراك" };
    }

    // 🚫 جهاز مختلف
    if (data.isUsed && data.deviceId && data.deviceId !== getDeviceId()) {
        return { success: false, message: "🚫 مستخدم على جهاز آخر" };
    }

    let daysLeft = null;

    if (data.expiresAt) {
        const diff = data.expiresAt.toDate() - new Date();
        daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    // 🔥 تحديث Firebase
    await docRef.set({
        isUsed: true,
        deviceId: getDeviceId(),
        activatedAt: new Date()
    }, { merge: true });

    return {
        success: true,
        message: "🎉 تم التفعيل بنجاح",
        daysLeft: daysLeft,
        expiresAt: data.expiresAt ? data.expiresAt.toDate() : null
    };
}

module.exports = { verifyKey };