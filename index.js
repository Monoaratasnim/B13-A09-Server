const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

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

        const result = await tutorCollection.find(filter).toArray();

        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
      }
    });

  
    app.post("/tutor", async (req, res) => {
      try {
        const tutorData = req.body;

        const data = {
          ...tutorData,
          createdAt: new Date(), 
        };

        const result = await tutorCollection.insertOne(data);
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Insert Error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB connected successfully");
  } finally {
    
  }
}

run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("Server is fine!");
});



app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});