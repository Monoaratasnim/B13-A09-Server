const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

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

    // =========================================
    // GET ALL TUTORS
    // =========================================
    app.get("/tutor", async (req, res) => {
      try {
        const { search, startDate, endDate } = req.query;

        let filter = {};

        if (search) {
          filter.tutorName = {
            $regex: search,
            $options: "i",
          };
        }

        if (startDate && endDate) {
          filter.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          };
        }

        const result = await tutorCollection
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to fetch tutors" });
      }
    });

    // =========================================
    // GET SINGLE TUTOR
    // =========================================
    app.get("/tutor/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await tutorCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "Tutor not found" });
        }

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to fetch tutor" });
      }
    });

    // =========================================
    // ADD TUTOR
    // =========================================
    app.post("/tutor", async (req, res) => {
      try {
        const tutorData = req.body;

        const newTutor = {
          ...tutorData,
          totalSlot: Number(tutorData.totalSlot),
          hourlyFee: Number(tutorData.hourlyFee),
          createdAt: new Date(),
        };

        const result = await tutorCollection.insertOne(newTutor);

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to add tutor" });
      }
    });

    // =========================================
    // BOOK SESSION (FIXED DUPLICATE BOOKING)
    // =========================================
    app.post("/bookings", async (req, res) => {
      try {
        const bookingData = req.body;

        // FIND TUTOR
        const tutor = await tutorCollection.findOne({
          _id: new ObjectId(bookingData.tutorId),
        });

        if (!tutor) {
          return res.status(404).send({ message: "Tutor not found" });
        }

        // ❗ DUPLICATE BOOKING CHECK (FIX)
        const existingBooking = await bookingCollection.findOne({
          tutorId: bookingData.tutorId,
          studentEmail: bookingData.studentEmail,
        });

        if (existingBooking) {
          return res.status(400).send({
            message: "You already booked this tutor",
          });
        }

        // SLOT CHECK
        if (tutor.totalSlot <= 0) {
          return res.status(400).send({
            message:
              "This session is fully booked. You can’t join at the moment.",
          });
        }

        // DATE CHECK
        const currentDate = new Date();
        const sessionDate = new Date(tutor.sessionStartDate);

        if (currentDate < sessionDate) {
          return res.status(400).send({
            message: "Booking is not available yet for this tutor",
          });
        }

        // SAVE BOOKING
        const booking = {
          ...bookingData,
          bookStatus: "Booked",
          bookedAt: new Date(),
        };

        const bookingResult = await bookingCollection.insertOne(booking);

        // DECREASE SLOT
        await tutorCollection.updateOne(
          { _id: new ObjectId(bookingData.tutorId) },
          { $inc: { totalSlot: -1 } }
        );

        res.send(bookingResult);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Booking failed" });
      }
    });

    // =========================================
    // GET ALL BOOKINGS
    // =========================================
    app.get("/bookings", async (req, res) => {
      try {
        const result = await bookingCollection
          .find()
          .sort({ bookedAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to fetch bookings" });
      }
    });

    // =========================================
    // GET BOOKINGS BY EMAIL
    // =========================================
    app.get("/bookings/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const result = await bookingCollection
          .find({ studentEmail: email })
          .toArray();

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to fetch bookings" });
      }
    });

    // =========================================
    // DELETE BOOKING
    // =========================================
    app.delete("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const booking = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({ message: "Booking not found" });
        }

        // RETURN SLOT
        await tutorCollection.updateOne(
          { _id: new ObjectId(booking.tutorId) },
          { $inc: { totalSlot: 1 } }
        );

        const result = await bookingCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Failed to delete booking" });
      }
    });

    // ROOT
    app.get("/", (req, res) => {
      res.send("Tutor Booking Server Running");
    });

    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB Connected");
  } finally {
    // optional cleanup
  }
}

run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});