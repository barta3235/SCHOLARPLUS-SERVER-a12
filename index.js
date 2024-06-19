const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const PORT = process.env.port || 5000;


//middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.n2g3mj5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const userCollection = client.db('m12a12_scholarplus').collection('users');
    const allScholarshipCollection = client.db('m12a12_scholarplus').collection('allScholarship');

    //middlewares
    const verifyToken = (req, res, next) => {
      console.log('Inside verify token middleware', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        req.decoded = decoded
        next();
      })
    }

    const verifyModerator = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isModerator = user?.role === 'moderator';
      if (!isModerator) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }



    //users
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    //top 6 scholarships
    app.get('/top6Scholarship', async (req, res) => {
      const result = await allScholarshipCollection.find().sort({ applicationfee: 1, postdate: -1 }).limit(6).toArray();
      res.send(result);
    })

    //all scholarships
    app.get('/allScholarship', async (req, res) => {
      const filterBySearch = req.query.search;
      const query = {
        $or: [
          { scholarshipname: { $regex: filterBySearch, $options: 'i' } },
          { universityname: { $regex: filterBySearch, $options: 'i' } },
          { degree: { $regex: filterBySearch, $options: 'i' } }
        ]
      }
      const result = await allScholarshipCollection.find(query).toArray();
      res.send(result);
    })

    //scholarship by Id
    app.get('/allScholarship/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allScholarshipCollection.findOne(query);
      res.send(result);

    })





    //scholarships
    //add scholarships
    app.post('/addScholarshipModerator', verifyToken, verifyModerator, async (req, res) => {
      const newScholarship = req.body;
      const result = await allScholarshipCollection.insertOne(newScholarship);
      res.send(result);
    })



    //Moderator Section.
    app.get('/users/moderator/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let moderator = false;
      if (user) {
        moderator = user?.role === 'moderator'
      }
      res.send({ moderator });
    })



    //JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({ token });
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', async (req, res) => {
  res.send('Scholar plus is live')
})

app.listen(PORT, () => {
  console.log('Scholar plus is live')
})