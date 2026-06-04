const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization
  if(!authHeader){
    return res.status(401).json({message: "Unauthorized"});
  }
  const token = authHeader.split(" ")[1]
  if(!token){
    return res.status(401).json({message: "Unauthorized"});
  }
 
  try{
    const {payload} = await jwtVerify(token, JWKS)
    console.log(payload)
     next()

  } catch (error) {
    return res.status(403).json({message: "Forbidden"});
  }
};
async function run() {
  try {
    // await client.connect();

    const db = client.db("mediqueue");

    const tutorCollection = db.collection("tutors");
    const bookingCollection = db.collection("bookings");
    const userCollection = db.collection("users");

    console.log("MongoDB Connected");

    
    app.post("/users/register", async (req, res) => {
      try {
        const { name, email, image, password } = req.body;

        if (!name || !email || !password) {
          return res.status(400).send({ message: "All fields required" });
        }

        const existingUser = await userCollection.findOne({ email });

        if (existingUser) {
          return res.status(400).send({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
          name,
          email,
          image: image || "",
          password: hashedPassword,
          provider: "email",
          createdAt: new Date(),
        };

        const result = await userCollection.insertOne(newUser);

        res.send({ ...newUser, _id: result.insertedId });

      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Signup failed" });
      }
    });

  
    app.post("/users/social-login", async (req, res) => {
      try {
        const { email, name, image, provider } = req.body;

        if (!email) {
          return res.status(400).send({ message: "Email required" });
        }

        const existingUser = await userCollection.findOne({ email });

        if (existingUser) {
          return res.send(existingUser);
        }

        const newUser = {
          email,
          name,
          image,
          provider,
          createdAt: new Date(),
        };

        const result = await userCollection.insertOne(newUser);

        res.send({ ...newUser, _id: result.insertedId });

      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Social login failed" });
      }
    });

    /* =========================
        CREATE TUTOR
    ========================== */
    app.post("/tutor", verifyToken, async (req, res) => {
      try {
        const tutor = {
          tutorName: req.body.tutorName,
          photo: req.body.photo,
          subject: req.body.subject,
          availability: req.body.availability,
          hourlyFee: Number(req.body.hourlyFee),
          totalSlot: Number(req.body.totalSlot),
          sessionStartDate: new Date(req.body.sessionStartDate),
          institution: req.body.institution,
          experience: req.body.experience,
          location: req.body.location,
          teachingMode: req.body.teachingMode,
          creatorEmail: req.body.creatorEmail,
          createdAt: new Date(),
        };

        if (!tutor.creatorEmail) {
          return res.status(400).send({ message: "creatorEmail required" });
        }

        const result = await tutorCollection.insertOne(tutor);
        res.send(result);

      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Failed to create tutor" });
      }
    });
/* =========================
    GET ALL TUTORS + FILTER
========================== */
app.get("/tutor", async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;

    let query = {};

    // Search by tutor name
    if (search) {
      query.tutorName = {
        $regex: search,
        $options: "i",
      };
    }

    // Filter by Session Date
    if (startDate || endDate) {
      query.sessionStartDate = {};

      if (startDate) {
        query.sessionStartDate.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        query.sessionStartDate.$lte = end;
      }
    }

    const result = await tutorCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);

  } catch (err) {
    console.log(err);
    res.status(500).send({ message: "Failed to fetch tutors" });
  }
});
   

    /* =========================
        SINGLE TUTOR
    ========================== */
    app.get("/tutor/:id", verifyToken, async (req, res) => {
      try {
        const tutor = await tutorCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!tutor) {
          return res.status(404).send({ message: "Tutor not found" });
        }

        res.send(tutor);

      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    /* =========================
        MY TUTORS BY EMAIL
    ========================== */
    app.get("/my-tutors/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;

        const result = await tutorCollection
          .find({ creatorEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);

      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Failed to fetch tutors" });
      }
    });

    /* =========================
        UPDATE TUTOR
    ========================== */
    app.patch("/tutor/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const result = await tutorCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res.send(result);

      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Update failed" });
      }
    });

    /* =========================
        DELETE TUTOR
    ========================== */
    app.delete("/tutor/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        const result = await tutorCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);

      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Delete failed" });
      }
    });

    /* =========================
        BOOKINGS
    ========================== */
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const data = req.body;

        const exists = await bookingCollection.findOne({
          tutorId: data.tutorId,
          studentEmail: data.studentEmail,
        });

        if (exists) {
          return res.status(400).send({ message: "Already booked" });
        }

        const booking = {
          ...data,
          bookStatus: "Booked",
          bookedAt: new Date(),
        };

        const result = await bookingCollection.insertOne(booking);

        await tutorCollection.updateOne(
          { _id: new ObjectId(data.tutorId) },
          { $inc: { totalSlot: -1 } }
        );

        res.send(result);

      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Booking failed" });
      }
    });

    /* =========================
        BOOKINGS BY EMAIL
    ========================== */
    app.get("/bookings/email/:email", verifyToken, async (req, res) => {
      const result = await bookingCollection
        .find({ studentEmail: req.params.email })
        .sort({ bookedAt: -1 })
        .toArray();

      res.send(result);
    });

    /* =========================
        CANCEL BOOKING
    ========================== */
    app.patch("/booking/cancel/:id", verifyToken, async (req, res) => {
      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { bookStatus: "Cancelled" } }
      );

      res.send(result);
    });

    app.get("/", (req, res) => {
      res.send("Server Running");
    });

    // await client.db("admin").command({ ping: 1 });

  } catch (err) {
    console.log(err);
  }
}

run();

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});