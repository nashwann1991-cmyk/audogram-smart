const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const filePath = path.join(app.getPath("userData"), "license.json");

// 💾 حفظ
function saveActivation(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 📖 قراءة (آمنة)
function getActivation() {
    try {
        if (!fs.existsSync(filePath)) return null;

        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw);

    } catch (err) {
        console.error("❌ خطأ في قراءة license.json:", err);
        return null;
    }
}

// 🔥 تحقق التفعيل
function isActivated() {
    const data = getActivation();

    if (!data || !data.active) return false;

    if (data.expiresAt) {
        const expireDate = new Date(data.expiresAt);

        if (expireDate < new Date()) {
            return { expired: true };
        }
    }

    return { active: true };
}

module.exports = {
    saveActivation,
    getActivation,
    isActivated
};