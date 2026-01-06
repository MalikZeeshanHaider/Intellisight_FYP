import db from "../../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
dotenv.config();

const saltRounds = 10;
export const main = (req,res)=>{
    res.render("layouts/main");
}

export const loginPage = (req, res) => {
  res.render("auth/login", { error: null, emailError: false, passwordError: false });
};

export const signupPage = (req, res) => {
  res.render("auth/signup");
};

export const forgotPasswordPage = (req, res) => {
  res.render("auth/forgotpassword");
};

export const resetpassword= (req, res) => {
  res.render("auth/reset-password", { token: req.params.token });
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  //  Password length check
  if (!password || password.length < 8 || password.length > 16) {
    return res.status(400).json({ success: false, message: "Password must be between 8 and 16 characters long." });
  }
  try {
    // check if already exists
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkResult.rows.length > 0) {
      return res.json({ success: false, message: "Email already exists. Try logging in." });
    }

    const hash = await bcrypt.hash(password, saltRounds);

    const token = jwt.sign({ name, email, password: hash }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "24h" });

    const approveLink = `http://localhost:4000/verify-user/${token}/approve`;
    const rejectLink = `http://localhost:4000/verify-user/${token}/reject`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "221083@students.au.edu.pk",
        pass: "afag ijik emzq blqo" 
      }
    });

    await transporter.sendMail({
      from: "221083@students.au.edu.pk",
      to: "221083@students.au.edu.pk", // admin mail
      subject: "New User Signup Request",
      html: `
        <div style="font-family:Arial, sans-serif; padding:20px; border:1px solid #ddd; border-radius:10px;">
          <h2>New User Signup Request</h2>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p>A new user wants to register. Approve or Reject:</p>
          <a href="${approveLink}" style="background:#28a745; color:#fff; padding:10px 15px; text-decoration:none; border-radius:5px;">Approve</a>
          <a href="${rejectLink}" style="background:#dc3545; color:#fff; padding:10px 15px; text-decoration:none; border-radius:5px; margin-left:10px;">Reject</a>
        </div>
      `
    });

    res.json({ success: true, message: "Signup request sent. Awaiting admin approval.Check your Email" });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error" });
  }
};

// admin approval/rejection
export const verifyUser = async (req, res) => {
  const { token, action } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const { name, email, password } = decoded;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "221083@students.au.edu.pk",
        pass: "afag ijik emzq blqo"
      }
    });

    if (action === "approve") {
      // save user in DB
      await db.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3)", [name, email, password]);

      // send confirmation to user
      await transporter.sendMail({
        from: "221083@students.au.edu.pk",
        to: email,
        subject: "Signup Approved",
        html: `
          <div style="font-family:Arial, sans-serif; padding:20px;">
            <h2 style="color:#28a745;">Welcome to IntelliSight!</h2>
            <p>Hi <b>${name}</b>,</p>
            <p>Your signup request has been approved. You can now log in.</p>
            <a href="http://localhost:4000/login" style="background:#007bff; color:#fff; padding:10px 15px; text-decoration:none; border-radius:5px;">Login Now</a>
          </div>
        `
      });

      return res.send("<h2>User approved and saved successfully.</h2>");
    } else {
      // send rejection mail
      await transporter.sendMail({
        from: "221083@students.au.edu.pk",
        to: email,
        subject: "Signup Rejected",
        html: `
          <div style="font-family:Arial, sans-serif; padding:20px;">
            <h2 style="color:#dc3545;">Signup Rejected</h2>
            <p>Hi <b>${name}</b>,</p>
            <p>Sorry, your signup request has been rejected by the admin.</p>
          </div>
        `
      });

      return res.send("<h2>User rejected. No account created.</h2>");
    }

  } catch (err) {
    console.error(err);
    return res.status(400).send("Invalid or expired token");
  }
};

export const login = async (req, res) => {
  
  let email =req.body.email;
  let password = req.body.password;

  try {
    const result = await db.query("SELECT * from users where email = $1", [email]);
    if (result.rows.length > 0) {
      let user = result.rows[0];
      let hashPassword = user.password;

      bcrypt.compare(password, hashPassword, (err, isMatch) => {
        if (err) {
          console.error("Error comparing passwords:", err);
        } else {
          if (isMatch) {
            //  Issue tokens
            console.log(user.id);
            console.log(user.email);
            const accessToken = jwt.sign({ id: user.id, email: user.email }, "access_secret", { expiresIn: "12h" });
            const refreshToken = jwt.sign({ id: user.id, email: user.email }, "refresh_secret", { expiresIn: "1d" });
            console.log(accessToken);
            console.log(refreshToken);
            res.cookie("accessToken",accessToken);
            res.cookie("refreshToken",refreshToken);

            res.json({
              message: "Login successful"
            });
          } else {
            res.render("auth/login", {
              error: "Incorrect email or password",
              emailError: true,
              passwordError: true
            });
          }
        }
      });
    } else {
      res.render("auth/login", {
        error: "User not found",
        emailError: true,
        passwordError: false
      });
    }
  } catch (err) {
    console.log(err);
    res.render("auth/login", {
      error: "Something went wrong. Try again later.",
      emailError: false,
      passwordError: false
    });
  }
};

export const refreshToken = (req, res) => {
  const { token } = req.body;

  if (!token || !refreshTokens.includes(token)) {
    return res.status(403).json({ message: "Refresh token not valid" });
  }

  jwt.verify(token, "refresh_secret", (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid refresh token" });

    const accessToken = jwt.sign({ id: decoded.id, email: decoded.email }, "access_secret", { expiresIn: "15m" });
    res.json({ accessToken });
  });
};

export const logout = (req, res) => {
  const { token } = req.body;
  refreshTokens = refreshTokens.filter(t => t !== token);
  res.json({ message: "Logged out successfully" });
};
export const forgotpassword = async (req, res) => {
  const email = req.body.email;

  try {
    const user = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Email not found" });
    }

    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10m" });

    const resetLink = `http://localhost:4000/reset-password/${token}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "221083@students.au.edu.pk",
        pass: "afag ijik emzq blqo" // ⚠️ make sure to use app password, not real one
      }
    });

    await transporter.sendMail({
      from: "221083@students.au.edu.pk",
      to: email,
      subject: "Password Reset - IntelliSight",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="background-color: #1B3C53; padding: 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">IntelliSight</h1>
            </div>
            <div style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.5;">
              <p>Hi,</p>
              <p>We received a request to reset your password. Click the button below to reset it. 
              The link is valid for <strong>15 minutes</strong>.</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                  style="background-color: #1B3C53; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>

              <p>If you didn’t request this, you can safely ignore this email.</p>
              <p style="margin-top: 20px;">Thanks,<br>The IntelliSight Team</p>
            </div>
            <div style="background-color: #f1f1f1; padding: 10px; text-align: center; font-size: 12px; color: #888888;">
              © 2025 IntelliSight. All rights reserved.
            </div>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: "Password reset email sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const newPassword = req.body.password;
  
  //  Password length check
  if (!newPassword || newPassword.length < 8 || newPassword.length > 16) {
    return res.status(400).json({ success: false, message: "Password must be between 8 and 16 characters long." });
  }
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const hash = await bcrypt.hash(newPassword, saltRounds);
    console.log(decoded.email);

    await db.query("UPDATE users SET password = $1 WHERE email = $2", [
      hash,
      decoded.email
    ]);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: "Invalid or expired token" });
  }
};
