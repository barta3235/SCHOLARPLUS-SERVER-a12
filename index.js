const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const PORT = process.env.port || 5000;


//middleware
app.use(cors({
  origin: '*',
}))
app.use(express.json())




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
    // await client.connect();


    const userCollection = client.db('m12a12_scholarplus').collection('users');
    const allScholarshipCollection = client.db('m12a12_scholarplus').collection('allScholarship');
    const appliedScholarshipCollection = client.db('m12a12_scholarplus').collection('appliedScholarship');
    const userReviewCollection = client.db('m12a12_scholarplus').collection('userReview');
    const userGetInTouchCollection = client.db('m12a12_scholarplus').collection('getInTouch');

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

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin'
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
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

    //get user information by email
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query)
      res.send(result);
    })

    //all scholarship count
    app.get('/scholarship-count', async (req, res) => {
      const count = await allScholarshipCollection.countDocuments();
      res.send({ count })
    })

    //top 6 scholarships
    app.get('/top6Scholarship', async (req, res) => {
      const result = await allScholarshipCollection.find().sort({ applicationfee: 1, postdate: -1 }).limit(6).toArray();
      res.send(result);
    })

    //all scholarships with search and pagination
    app.get('/allScholarship', async (req, res) => {
      const filterBySearch = req.query.search;
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const query = {
        $or: [
          { scholarshipname: { $regex: filterBySearch, $options: 'i' } },
          { universityname: { $regex: filterBySearch, $options: 'i' } },
          { degree: { $regex: filterBySearch, $options: 'i' } }
        ]
      }
      const result = await allScholarshipCollection.find(query).skip(size * page).limit(size).toArray();
      res.send(result);
    })

    //scholarship by Id
    app.get('/allScholarship/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allScholarshipCollection.findOne(query);
      res.send(result);
    })

    app.get('/scholarship/payment/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id)
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

    //moderator ||  get all scholarships
    app.get('/user/moderator/allScholarship', verifyToken, verifyModerator, async (req, res) => {
      const result = await allScholarshipCollection.find().toArray();
      res.send(result);
    })

    //moderator || Delete a scholarship from all scholarship
    app.delete('/user/moderator/allScholarship/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await allScholarshipCollection.deleteOne(query);
      res.send(result);
    })

    //moderator || get each scholarship data by id
    app.get('/user/moderator/allScholarship/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allScholarshipCollection.findOne(query);
      res.send(result);
    })

    //moderator || update all scholar ship data.
    app.put('/user/moderator/allScholarship/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedScholarship = {
        $set: {
          scholarshipname: data.scholarshipname,
          subjectcategory: data.subjectcategory,
          scholarshipCategory: data.scholarshipCategory,
          degree: data.degree,
          tuitionfee: data.tuitionfee,
          applicationfee: data.applicationfee,
          servicecharge: data.servicecharge,
          description: data.description,
          universityname: data.universityname,
          universityimage: data.universityimage,
          country: data.country,
          city: data.city,
          worldranking: data.worldranking,
          postdate: data.postdate,
          applicationdeadline: data.applicationdeadline,
          email: data.email
        }
      }
      const result = await allScholarshipCollection.updateOne(filter, updatedScholarship, options);
      res.send(result);
    })

    //moderator || get all reviews 
    app.get('/user/moderator/allReview', verifyToken, verifyModerator, async (req, res) => {
      const result = await userReviewCollection.find().toArray();
      res.send(result);
    })

    //moderator || delete a review
    app.delete('/user/moderator/allReviewDelete/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userReviewCollection.deleteOne(query);
      res.send(result);

    })



    //moderator || get all applied scholarship
    app.get('/user/moderator/allAppliedScholarships', verifyToken, verifyModerator, async (req, res) => {
      const result = await appliedScholarshipCollection.find().toArray();
      res.send(result);
    })

    //moderator || get one applied scholarship at a time
    app.get('/user/moderator/eachAppliedScholarships/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await appliedScholarshipCollection.findOne(query)
      res.send(result);
    })

    //moderator || delete one applied scholarship at a time
    app.delete('/user/moderator/eachAppliedScholarships/delete/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await appliedScholarshipCollection.deleteOne(query)
      res.send(result);
    })


    app.put('/user/moderator/updateStatusAfterDelete/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id
      const newStatus = req.body
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updatedStatus = {
        $set: {
          status: newStatus.status
        }
      }
      const result = await appliedScholarshipCollection.updateOne(filter, updatedStatus, options)
      res.send(result);
    })

    //moderator || update feed back in applied scholarship
    app.put('/user/moderator/addFeedBack/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const feedback = req.body;
      const newFeedBack = {
        $set: {
          feedback: feedback.moderatorFeedback
        }
      }
      console.log(id);
      console.log(feedback);
      const result = await appliedScholarshipCollection.updateOne(filter, newFeedBack, options)
      res.send(result);
    })

    //moderator || update status in applied scholarship
    app.put('/user/moderator/updateStatus/:id', verifyToken, verifyModerator, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const newStatus = req.body;
      const updatedNewStatus = {
        $set: {
          status: newStatus.statusChange
        }
      }
      const result = await appliedScholarshipCollection.updateOne(filter, updatedNewStatus, options)
      res.send(result);
    })

    //moderator see get in touch messages
    app.get('/getInTouch', async (req, res) => {
      const result = await userGetInTouchCollection.find().toArray();
      res.send(result);
    })

    app.delete('/getInTouch/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userGetInTouchCollection.deleteOne(query);
      res.send(result);
    })

    //moderator ends Admin starts







    //ADMIN STARTS******


    //is admin (hook)
    app.get('/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })


    // add scholarship by admin 
    app.post('/addScholarshipAdmin', verifyToken, verifyAdmin, async (req, res) => {
      const newScholarship = req.body;
      const result = await allScholarshipCollection.insertOne(newScholarship);
      res.send(result);
    })

    //manage scholarship by admin
    app.get('/allScholarshipAdmin', verifyToken, verifyAdmin, async (req, res) => {
      const result = await allScholarshipCollection.find().toArray();
      res.send(result);
    })

    // delete scholarship by admin
    app.delete('/allScholarshipDeleteByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await allScholarshipCollection.deleteOne(query);
      res.send(result);
    })

    // get each scholarship by id by admin
    app.get('/allScholarshipAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allScholarshipCollection.findOne(query);
      res.send(result);
    })

    //update each scholarship by admin
    app.put('/allScholarshipUpdateByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedScholarship = {
        $set: {
          scholarshipname: data.scholarshipname,
          subjectcategory: data.subjectcategory,
          scholarshipCategory: data.scholarshipCategory,
          degree: data.degree,
          tuitionfee: data.tuitionfee,
          applicationfee: data.applicationfee,
          servicecharge: data.servicecharge,
          description: data.description,
          universityname: data.universityname,
          universityimage: data.universityimage,
          country: data.country,
          city: data.city,
          worldranking: data.worldranking,
          postdate: data.postdate,
          applicationdeadline: data.applicationdeadline,
          email: data.email
        }
      }
      const result = await allScholarshipCollection.updateOne(filter, updatedScholarship, options);
      res.send(result);
    })


    //applied scholarship admin part



    //admin || get all applied scholarship
    app.get('/allAppliedScholarshipsAdmin', verifyToken, verifyAdmin, async (req, res) => {
      const result = await appliedScholarshipCollection.find().toArray();
      res.send(result);
    })

    //admin || get one applied scholarship at a time
    app.get('/eachAppliedScholarshipsByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await appliedScholarshipCollection.findOne(query)
      res.send(result);
    })


    // admin || update status of application by clicking delete or cancel
    app.put('/updateStatusAfterDeleteByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const newStatus = req.body
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updatedStatus = {
        $set: {
          status: newStatus.status
        }
      }
      const result = await appliedScholarshipCollection.updateOne(filter, updatedStatus, options)
      res.send(result);
    })

    //admin || update feed back in applied scholarship
    app.put('/addFeedBackByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const feedback = req.body;
      const newFeedBack = {
        $set: {
          feedback: feedback.moderatorFeedback
        }
      }
      console.log(id);
      console.log(feedback);
      const result = await appliedScholarshipCollection.updateOne(filter, newFeedBack, options)
      res.send(result);
    })

    //admin || update status in applied scholarship
    app.put('/updateStatusByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const newStatus = req.body;
      const updatedNewStatus = {
        $set: {
          status: newStatus.statusChange
        }
      }
      const result = await appliedScholarshipCollection.updateOne(filter, updatedNewStatus, options)
      res.send(result);
    })


    // allreviews admin part

    //admin || get all reviews 
    app.get('/allReviewsByAdmin', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userReviewCollection.find().toArray();
      res.send(result);
    })

    app.delete('/reviewDeleteByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userReviewCollection.deleteOne(query);
      res.send(result);

    })



    // all user by admin


    // admin || get all users of all role
    app.get('/allUsersByAdmin', verifyToken, verifyAdmin, async (req, res) => {
      const role = req.query.role;
      console.log(role);
      let query = {};
      if (role && role !== 'all') {
        query.role = role;
      }
      console.log(query)
      const result = await userCollection.find(query).toArray()
      res.send(result)
    })

    //admin // change user role API
    app.put('/userRoleChangeByAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const newRole = req.body;
      console.log(filter, newRole);
      const updatedNewRole = {
        $set: {
          role: newRole.roleChange
        }
      }

      const result = await userCollection.updateOne(filter, updatedNewRole, options);
      res.send(result);
    })

    // admin || delete user by admin
    app.delete('/deleteUserByAdmin/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })



    //analytics by admin 
    app.get('/analytics1ByAdmin', verifyToken, verifyAdmin, async (req, res) => {
      const allScholarshipCount = await allScholarshipCollection.estimatedDocumentCount();
      const userCount = await userCollection.estimatedDocumentCount();
      const appliedCount = await appliedScholarshipCollection.estimatedDocumentCount();

      const totalFees = await appliedScholarshipCollection.aggregate([
        {
          $group: {
            _id: null,
            totalFeesGenerated: { $sum: '$payment' }
          }
        }
      ]).toArray();
      const totalApplicationFee = totalFees.length > 0 ? totalFees[0].totalFeesGenerated : 0;

      const universityApplication = await appliedScholarshipCollection.aggregate([
        {
          $group: {
            _id: '$universityname',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 } 
        },
        {
          $limit: 4 
        }
      ]).toArray();


      res.send({ allScholarshipCount, userCount, appliedCount, totalApplicationFee,universityApplication });
    })










    //*************ADMIN ENDS */


    //top-4 reviews
    app.get('/reviewsTop4', async (req, res) => {
      const result = await userReviewCollection.find().sort({ rating: 1 }).limit(4).toArray();
      res.send(result);
    })


    // home page get in touch section post 
    app.post('/getInTouch', async (req, res) => {
      const data = req.body;
      const result = await userGetInTouchCollection.insertOne(data)
      res.send(result);
    })

    //single reviews for carousel slider for scholarships in scholarship details
    app.get('/specificReviews/:id', async (req, res) => {
      const id = req.params.id;
      const query = { scholarshipid: id }
      const result = await userReviewCollection.find(query).toArray();
      res.send(result);
    })








    //JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({ token });
    })


    //payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount);

      //create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    //appliedScholarshipByUser
    app.post('/appliedScholarshipByUser', verifyToken, async (req, res) => {
      const data = req.body;
      const result = await appliedScholarshipCollection.insertOne(data)
      res.send(result);
    })

    app.get('/appliedScholarshipByUser/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await appliedScholarshipCollection.find(query).toArray();
      res.send(result);
    })




    //appliedScholarshipByUser/update
    app.get('/appliedScholarshipByUser/update/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await appliedScholarshipCollection.findOne(query);
      res.send(result);
    })

    app.put('/appliedScholarshipByUser/update/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const newData = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updatedData = {
        $set: {
          applicantphone: newData.applicantphone,
          applicantgender: newData.applicantgender,
          applicantimage: newData.applicantimage,
          applicantdegree: newData.applicantdegree,
          country: newData.country,
          district: newData.district,
          village: newData.village,
          ssc: newData.ssc,
          hsc: newData.hsc,
          studygap: newData.studygap,
        }
      }
      const result = await appliedScholarshipCollection.updateOne(filter, updatedData, options);
      console.log(result);
      res.send(result);
    })

    //applied scholarship delete
    app.delete('/appliedScholarshipByUser/delete/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await appliedScholarshipCollection.deleteOne(query);
      res.send(result);
    })


    // user review
    app.post('/userReview', verifyToken, async (req, res) => {
      const newReview = req.body;
      const result = await userReviewCollection.insertOne(newReview);
      res.send(result);
    })

    app.get('/userReview/:email', verifyToken, async (req, res) => {
      const userEmail = req.params.email;
      const query = { useremail: userEmail }
      const result = await userReviewCollection.find(query).toArray()
      res.send(result);
    })

    app.get('/userReviewById/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userReviewCollection.findOne(query)
      res.send(result);
    })

    app.put('/userReviewUpdate/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedReview = req.body;
      const options = { upsert: true }
      const updatedData = {
        $set: {
          rating: updatedReview.rating,
          date: updatedReview.date,
          comment: updatedReview.comment,
          scholarshipid: updatedReview.scholarshipid,
          scholarshipname: updatedReview.scholarshipname,
          universityname: updatedReview.universityname,
          username: updatedReview.username,
          useremail: updatedReview.useremail,
        }
      }
      const result = await userReviewCollection.updateOne(filter, updatedData, options);
      res.send(result);
    })



    app.delete('/userReview/delete/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userReviewCollection.deleteOne(query)
      res.send(result);
    })






    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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