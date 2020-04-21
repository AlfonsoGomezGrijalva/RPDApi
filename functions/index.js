const admin = require('firebase-admin');
const functions = require('firebase-functions');

const express = require('express');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({ origin: true });
const app = express();

admin.initializeApp();

let db = admin.firestore();

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = async (req, res, next) => {
    console.log('Check if request is authorized with Firebase ID token');
  
    if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !(req.cookies && req.cookies.__session)) {
      console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
        'Make sure you authorize your request by providing the following HTTP header:',
        'Authorization: Bearer <Firebase ID Token>',
        'or by passing a "__session" cookie.');
      res.status(403).send('Unauthorized');
      return;
    }
  
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      console.log('Found "Authorization" header');
      // Read the ID Token from the Authorization header.
      idToken = req.headers.authorization.split('Bearer ')[1];
    } else if (req.cookies) {
      console.log('Found "__session" cookie');
      // Read the ID Token from cookie.
      idToken = req.cookies.__session;
    } else {
      // No cookie
      res.status(403).send('Unauthorized');
      return;
    }
  
    try {
      console.log("token: " + idToken);
      const decodedIdToken = await admin.auth().verifyIdToken(idToken, true);
      console.log('ID Token correctly decoded', decodedIdToken);
      req.user = decodedIdToken;
      next();
      return;
    } catch (error) {
      console.error('Error while verifying Firebase ID token:', error);
      res.status(403).send('Unauthorized');
      return;
    }
  };
  
app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);

app.get('/rpd',async (req,res)=>{
    try {
      let data = [];
      let result = [];
      let count = 0;
      let rdpCollection =  db.collection('RPD');
      await rdpCollection.get()
          .then(snapshot => {
            count = snapshot.size;
            snapshot.forEach(doc => {          
              data.push({id: doc.id, ...doc.data()});
            });
          })
          .catch(err => {
            console.log('Error getting documents', err);
          });
        
        result.push({totalCount: count, items: data});

        res.status(200).send(result);

      } catch (error) {
        res.status(500).send(error);
      } 
  });

app.post("/rpd", async (req,res)=>{
  try{
 
    const newRpd = {
          fecha: req.body.fecha,
          situacion: req.body.situacion,
          pensamiento: req.body.pensamiento,
          emocion: req.body.emocion,
          respuesta: req.body.respuesta,
          resultado: req.body.resultado,
          user: '9a3tjYVnLIXEEvCiq9llSkU3cg53'
    }

    if(!!req.body.id)
      await db.collection('RPD').doc(req.body.id).set(newRpd, {merge: true});
    else{
      let date = new Date();
      let docID = date.getFullYear() + ("0" + (date.getMonth() + 1)).slice(-2) + ("0" + date.getDate()).slice(-2) + ("0" + date.getHours() + 1 ).slice(-2) + ("0" + date.getMinutes()).slice(-2) + ("0" + date.getSeconds()).slice(-2)

      await db.collection('RPD').doc(docID).set(newRpd);
    }
    res.sendStatus(201);
  }
  catch(error) 
  {
      console.log(error);
      res.status(500).send(error);
  }
  });
  
  app.delete('/rpd', (req, res)=>{
    try {
      if(!!req.body.id)
      {
        db.collection('RPD').doc(req.body.id).delete();
        res.sendStatus(200);
      }
      else
        res.sendStatus(400);
    } catch (error) {
      res.status(500).send(error);
    }    
  });

  app.post('/users', (req, res) => {
    const newUserAuth = {
      email: req.body.email.toLowerCase(),
      password: req.body.password
    };
  
    const addNewUser = {
      email: req.body.email.toLowerCase(),
      role: req.body.role,
      name: req.body.name
    };
  
    admin.auth().createUser(newUserAuth)
      .then(userRecord => {
        db.collection('users').doc(userRecord.uid).set(addNewUser);
        res.sendStatus(201);
      })
      .catch(error => {
        console.log(error);
        res.status(500).send(error);
      });
  });

  app.delete('/users',  (req,res)=>{
    const userUID = req.body.id;
  
    admin.auth().deleteUser(userUID)
      .then(async userRecord => {
        await db.collection('users').doc(userUID).delete();
        res.sendStatus(200);
      })
      .catch(error => {
        console.log(error);
        res.status(500).send(error);
      });
  });

  app.delete('/signout', async (req, res) => {
    const token = req.headers.authorization.split('Bearer ')[1]
    const result = await admin.auth().verifyIdToken(token);
    await admin.auth().revokeRefreshTokens(result.uid);
  
    res.status(200);
  });
// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.https.onRequest(app);
