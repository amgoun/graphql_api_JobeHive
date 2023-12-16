import { PrismaClient } from "@prisma/client";

//import { GraphQLUpload } from 'graphql-upload';

import jwt from "jsonwebtoken";
import {
  generateToken,
  hashPassword,
  verifyPassword,
  refreshTokens,
} from "./auth.js";

import Stripe from "stripe";

// ------  BLOCK 01 CODE imports--------
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
//------------------------------------

//import { GraphQLUpload } from 'graphql-upload';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import GraphQLUpload from "graphql-upload/GraphQLUpload.mjs";

const prisma = new PrismaClient();

const APP_SECRET = process.env.APP_SECRET || "myjwtsecret";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "myjwtrefreshsecret";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2020-08-27",
});

// Utility function to extract the file extension
const fileExt = (filename) => {
  return path.extname(filename).slice(1).toLowerCase();
};


const suggestions = {
  categories: ['Category A', 'Category B', 'Category C'],
  locations: ['Location X', 'Location Y', 'Location Z'],
  skillLevels: ['Beginner', 'Intermediate', 'Advanced'],
};

const resolvers = {
  Upload: GraphQLUpload,

  Query: {
    applications: async () => {
      const applications = await prisma.application.findMany();
      return applications;
    },

    jobs: async (parent, { category, location, skillLevel }) => {
      const where = {
        category: category || undefined,
        location: location || undefined,
        skillLevel: skillLevel || undefined,
      };
      return prisma.job.findMany({
        where,
      });
    },

    querySuggestions: () => suggestions,
 

    job: async (parent, { id }) => {
      return prisma.job.findUnique({ where: { id: parseInt(id) } });
    },
    me: async (parent, args, { userId }) => {
      if (!userId) {
        throw new Error("You are not authenticated");
      }
      return prisma.user.findUnique({
        where: { id: userId },
      });
    },
  },

  Mutation: {
    refreshTokens: async (parent, { refreshToken }) => {
      try {
        const decoded = jwt.verify(refreshToken, APP_SECRET + REFRESH_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });
        if (!user) {
          throw new Error("Invalid refresh token");
        }
        const tokens = generateToken(user);
        return {
          user,
          ...tokens,
        };
      } catch (error) {
        throw new Error("Invalid refresh token");
      }
    },

    signup: async (_, { input }, { context }) => {
      const { name, email, password } = input;
      if (!name || !email || !password) {
        throw new Error("Name, email, and password are required");
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });
      return { user, token: jwt.sign({ userId: user.id }, APP_SECRET) };
    },

    login: async (parent, { input }) => {
      const { email, password } = input;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error("Invalid login credentials");
      }
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        throw new Error("Invalid login credentials");
      }
      const { token, refreshToken } = generateToken(user);
      return { user, token, refreshToken };
    },


    uploadCV: async (_, { file }, { userId }) => {
      if (!userId) {
        throw new Error("Not authenticated");
      }

      const { createReadStream, filename } = await file;
      const stream = createReadStream();

      // Save the new PDF file
      const uploadDir = path.join(__dirname, "../uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const ext = fileExt(filename);
      if (ext !== "pdf") {
        throw new Error("Only PDF files are allowed");
      }

      // Check if the user already has a PDF file
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user.cvPath) {
        // User already has a PDF file, handle update logic
        const existingFilePath = path.join(__dirname, user.cvPath);

        // Delete the existing file
        fs.unlinkSync(existingFilePath);
      }

      const filePath = path.join(uploadDir, filename);
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);

      // Update the user's record with the new PDF file path
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { cvPath: path.relative(__dirname, filePath) }, // Store the relative path in the database
      });

      return updatedUser;
    },

    // Mutation resolver to delete the PDF file
    deleteCV: async (_, args, { userId }) => {
      console.log(userId);
      if (!userId) {
        throw new Error("Not authenticated");
      }

      // Check if the user has a PDF file
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user.cvPath) {
        throw new Error("User does not have a PDF file");
      }

      // Delete the PDF file
      const filePath = path.join(__dirname, user.cvPath);
      fs.unlinkSync(filePath);

      // Update the user's record to remove the PDF file path
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { cvPath: null },
      });

      return updatedUser;
    },

    createJob: async (parent, { input }, context) => {
      const { userId, authToken, refreshToken } = context;

      if (!userId) {
        throw new Error("You are not authenticated");
      }

      try {
        const job = await prisma.job.create({
          data: {
            ...input,
            user: { connect: { id: userId } },
          },
        });

        return job;
      } catch (error) {
        if (error.message === "jwt expired") {
          const { token } = refreshTokens(refreshToken);
          context.authToken = token; // update the authToken property in the context object

          const job = await prisma.job.create({
            data: {
              ...input,
              user: { connect: { id: userId } },
            },
          });

          return job;
        } else {
          throw error;
        }
      }
    },

  applyForJob: async (_, { input }, { userId }) => {
    if (!userId) {
      throw new Error("You are not authenticated");
    }

    const { jobId } = input;

    // Check if the user has already applied for the job
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId: parseInt(jobId),
        userId: parseInt(userId),
      },
    });

    if (existingApplication) {
      throw new Error("You have already applied for this job");
    }

    const job = await prisma.job.findUnique({
      where: { id: parseInt(jobId) },
    });

    if (!job) {
      throw new Error("Job not found");
    }

    const application = await prisma.application.create({
      data: {
        job: { connect: { id: job.id } },
        user: { connect: { id: userId } },
      },
    });

    return application;
  },


    subscribe: async (_, { email, paymentMethodId, lifetime }, { userId }) => {
      if (!userId) {
        throw new Error("You are not authenticated");
      }
      
      try {
        // Create a new Stripe customer with the provided email address and payment method
        const customer = await stripe.customers.create({
          email,
          payment_method: paymentMethodId,
          invoice_settings: {
            default_payment_method: paymentMethodId,
       
          },
        });

        // Create the Stripe subscription price
        const interval = lifetime ? "year" : "month";
        const unitAmount = lifetime ? 10000 : 2000;
        const price = await stripe.prices.create({
          unit_amount: unitAmount,
          currency: "usd",
          recurring: { interval },
          product: process.env.STRIPE_PRODUCT_ID,
        });

        // Subscribe the customer to the pricing plan
        const subscription = await stripe.createSubscription(
          customer.id,
          price.id
        );

        return { success: true, subscription };
      } catch (error) {
        console.error(error);
        return { success: false, message: error.message };
      }
    },
    cancelSubscription: async (_, { subscriptionId }, { userId }) => {
      if (!userId) {
        throw new Error("You are not authenticated");
      }
      try {
        // Cancel the Stripe subscription
        const subscription = await stripe.cancelSubscription(subscriptionId);

        return { success: true, subscription };
      } catch (error) {
        console.error(error);
        return { success: false, message: error.message };
      }
    },
  },

Subscription: {
  applicationMade: {
    subscribe: async (parent, { jobId }, { pubsub, userId }) => {
      const channel = `APPLICATION_MADE_${jobId}`;

      // Retrieve the job to check if the current user is the creator
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Only subscribe to the channel if the current user is the creator of the job
      if (job.createdBy === userId) {
        return pubsub.asyncIterator(channel);
      } else {
        // Return an empty iterator if the current user is not the creator
        return {
          async next() {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay for 1 second before returning an empty result
            return { done: true, value: null };
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        };
      }
    },
  },
},

  Job: {
    user: async (parent) => {
      return prisma.job.findUnique({ where: { id: parent.id } }).user();
    },
    applications: async (parent) => {
      return prisma.job.findUnique({ where: { id: parent.id } }).applications();
    },
  },
  User: {
    jobs: async (parent) => {
      return prisma.user.findUnique({ where: { id: parent.id } }).jobs();
    },
  },
};

export { resolvers as default };
