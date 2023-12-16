// 1
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import graphqlUploadExpress from "graphql-upload/graphqlUploadExpress.mjs";
// 2
import typeDefs from './typeDefs.js';
import resolvers from './resolvers.js';

//import { verifyToken } from './auth.js'

import { getUserId, refreshTokens } from './auth.js';

import cookieParser from 'cookie-parser';

// 3
(async () => {
// 4
try {
    const app = express();

    const httpServer = createServer(app);
    // 5
    const server = new ApolloServer({
        typeDefs,
        resolvers,
        introspection: true,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer }),       
        ],              
       
      });
  
    // 6
    await server.start();
    
    app.use(
        '/',
        cookieParser(),
        cors({
          credentials: true,
          origin: 'https://sandbox.embed.apollographql.com',
          methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
          exposedHeaders: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials'],
        }),
        bodyParser.json(),
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
        expressMiddleware(server,{
          context: ({ req, res }) => {
            const authToken = req.headers.authorization || "";
            const refreshToken = req.headers.refresh_token || null;
            const userId = authToken ? getUserId(req, res, authToken) : null;
          //  console.log('refreshToken:', refreshToken);
            return {
              ...req,
              authToken,
              refreshToken,
              userId,
              refreshTokens: () => refreshTokens(refreshToken),
              'Apollo-Require-Preflight': 'true'
            };
          },
          // Make sure to set cors to `false` here to avoid CORS issues with `expressMiddleware`
          cors: false,
          introspection: true, // enable introspection              
        })    
    ); 
    // 7
   
    await new Promise((resolve) => httpServer.listen({ port:4000}, resolve));

       console.log(`🚀 Server ready at http://localhost:4000`);
    } catch (e) {
       console.error(e)
}
})()