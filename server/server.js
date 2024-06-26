import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  cors({
    origin: [process.env.BASE_URL],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.options("*", cors());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", (req, res) => {
  res.send("Welcome to the authentication system!");
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    bcrypt.hash(password, saltRounds, async (err, hash) => {
      if (err) {
        console.error("Error hashing password:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      const { data, error } = await supabase
        .from("users")
        .insert([{ username, password: hash }])
        .single();

      if (error) {
        console.error("Error inserting user:", error);
        return res.status(500).json({ error: "Internal server error" });
      }

      return res.status(200).json({ message: "User registered successfully" });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/logout", (req, res) => {
  req.logout();
  res.status(200).json({ message: "Logged out successfully" });
});

app.get("/points", async (req, res) => {
  try {
    const { data, error } = await supabase.from("points").select("*");

    if (error) {
      console.error("Error fetching points:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .single();

      if (error || !user) {
        return cb(null, false);
      }

      bcrypt.compare(password, user.password, (err, valid) => {
        if (err) {
          console.error("Error comparing passwords:", err);
          return cb(err);
        }

        if (valid) {
          return cb(null, user);
        } else {
          return cb(null, false);
        }
      });
    } catch (err) {
      console.error(err);
      return cb(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
