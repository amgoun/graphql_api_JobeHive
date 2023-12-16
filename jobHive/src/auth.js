import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const APP_SECRET = process.env.APP_SECRET || "myjwtsecret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "myjwtrefreshsecret";

export function generateToken(user) {
  const token = jwt.sign({ userId: user.id }, APP_SECRET, {
    expiresIn: "1d",
  });
  const refreshToken = jwt.sign(
    { userId: user.id },
    APP_SECRET + REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );

  return {
    token,
    refreshToken,
  };
}

export function getUserId(req, res) {
  const authorizationHeader = req.headers.authorization || "";
  const token = authorizationHeader.replace("Bearer ", "");

  if (!token) {
    throw new Error("No token found");
  }

  try {
    const { userId } = jwt.verify(token, APP_SECRET);
    return userId;
  } catch (error) {
    if (error.name !== "TokenExpiredError") {
      throw new Error("Could not authenticate token");
    }
  }

  const refreshToken = req.cookies.refreshToken || "";

  if (!refreshToken) {
    throw new Error("No refresh token found");
  }

  try {
    const { userId } = jwt.verify(refreshToken, REFRESH_SECRET);

    const token = jwt.sign({ userId }, APP_SECRET, { expiresIn: "1d" });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/refresh_token",
      sameSite: "none",
      secure: true,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.set("Authorization", `Bearer ${token}`);

    return userId;
  } catch (error) {
    throw new Error("Could not refresh token");
  }
}

export function refreshTokens(refreshToken, res) {
  let userId = -1;
  try {
    const { userId: oldUserId } = jwt.decode(refreshToken);
    userId = oldUserId;
  } catch (e) {
    throw new Error("Invalid refresh token");
  }

  const newToken = jwt.sign({ userId }, APP_SECRET, { expiresIn: "1d" });
  const newRefreshToken = jwt.sign({ userId }, APP_SECRET + REFRESH_SECRET, {
    expiresIn: "7d",
  });

  // set the cookie with SameSite=None; Secure attributes
  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    path: "/refresh_token",
    sameSite: "none",
    secure: true,
  });
  return {
    token: newToken,
    refreshToken: newRefreshToken,
    userId,
  };
}

// hash the user's password before storing it in the database
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

// verify the user's password against the hash stored in the database
export async function verifyPassword(password, hash) {
  const isValid = await bcrypt.compare(password, hash);
  return isValid;
}
