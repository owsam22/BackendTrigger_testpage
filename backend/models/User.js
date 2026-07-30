const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    // You flip this manually in MongoDB Atlas / Compass to promote a user to admin.
    isAdmin: { type: Boolean, default: false },

    // Reserved for later. Not enforced anywhere yet — toggle manually if needed.
    // Free tier logic currently just checks submission count, not this field.
    plan: { type: String, enum: ["free", "pro"], default: "free" },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    isAdmin: this.isAdmin,
    plan: this.plan,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", UserSchema);
