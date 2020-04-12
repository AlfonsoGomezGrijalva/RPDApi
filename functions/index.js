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
// app.use(validateFirebaseIdToken);

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
    else
      await db.collection('RPD').doc().set(newRpd);

    res.sendStatus(201);
  }
  catch(error) 
  {
      console.log(error);
      res.status(500).send(error);
  }
  });
  

  // This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.https.onRequest(app);
