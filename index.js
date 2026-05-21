const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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

async function run() {
  try {
    await client.connect();

    const db = client.db("mediqueue");
    const tutorCollection = db.collection("tutors");
    const bookingCollection = db.collection("bookings");

    /* =========================
        CREATE TUTOR (FULL FIXED)
    ========================== */
    app.post("/tutor", async (req, res) => {
      try {
        const tutor = {
          tutorName: req.body.tutorName,
          photo: req.body.photo, // ✅ FIXED (image was missing before)
          subject: req.body.subject,
          availability: req.body.availability,
          hourlyFee: Number(req.body.hourlyFee),
          totalSlot: Number(req.body.totalSlot),
          sessionStartDate: req.body.sessionStartDate,
          institution: req.body.institution,
          experience: req.body.experience,
          location: req.body.location,
          teachingMode: req.body.teachingMode,
          creatorEmail: req.body.creatorEmail, // important
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
        GET ALL TUTORS
    ========================== */
    app.get("/tutor", async (req, res) => {
      const result = await tutorCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    /* =========================
        SINGLE TUTOR
    ========================== */
    app.get("/tutor/:id", async (req, res) => {
      const tutor = await tutorCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!tutor) {
        return res.status(404).send({ message: "Tutor not found" });
      }

      res.send(tutor);
    });

    /* =========================
        MY TUTORS
    ========================== */
    app.get("/my-tutors/:email", async (req, res) => {
      const result = await tutorCollection
        .find({ creatorEmail: req.params.email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    /* =========================
        UPDATE TUTOR
    ========================== */
    app.patch("/tutor/:id", async (req, res) => {
      const result = await tutorCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );

      res.send(result);
    });

    /* =========================
        DELETE TUTOR
    ========================== */
    app.delete("/tutor/:id", async (req, res) => {
      const result = await tutorCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });

    /* =========================
        BOOK SESSION
    ========================== */
    app.post("/bookings", async (req, res) => {
      try {
        const data = req.body;

        const tutor = await tutorCollection.findOne({
          _id: new ObjectId(data.tutorId),
        });

        if (!tutor) {
          return res.status(404).send({ message: "Tutor not found" });
        }

        const exists = await bookingCollection.findOne({
          tutorId: data.tutorId,
          studentEmail: data.studentEmail,
        });

        if (exists) {
          return res.status(400).send({
            message: "Already booked",
          });
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
        BOOKINGS
    ========================== */
    app.get("/bookings/email/:email", async (req, res) => {
      const result = await bookingCollection
        .find({ studentEmail: req.params.email })
        .sort({ bookedAt: -1 })
        .toArray();

      res.send(result);
    });

    /* =========================
        CANCEL BOOKING
    ========================== */
    app.patch("/booking/cancel/:id", async (req, res) => {
      const result = await bookingCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { bookStatus: "Cancelled" } }
      );

      res.send(result);
    });

    app.get("/tutor", async (req, res) => {
  const result = await tutorCollection.find().limit(6).toArray();
  res.send(result);
});

    app.get("/", (req, res) => {
      res.send("Server Running");
    });

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected");
  } catch (err) {
    console.log(err);
  }
}

run();

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});