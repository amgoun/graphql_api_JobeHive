import gql from 'graphql-tag';


const typeDefs = gql`

 scalar Upload

  input SignupInput {
    name: String!
    email: String!
    password: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreateJobInput {
    title: String!
    description: String!
    location: String!
    category: String!
    skillLevel: String!
    company: String
  }

  input ApplyForJobInput {
    jobId: ID!
  }

  type Query {
    jobs(
      category: String
      location: String
      skillLevel: String
    ): [Job!]!
    job(id: ID!): Job
    querySuggestions: QuerySuggestions
    me: User
    applications: [Application!]!
  }

  type QuerySuggestions {
  categories: [String!]!
  locations: [String!]!
  skillLevels: [String!]!
}

  type Mutation {
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    refreshTokens(refreshToken: String!): AuthPayload!
    uploadCV(file: Upload!): User!
    deleteCV: User!
    createJob(input: CreateJobInput!): Job!
    applyForJob(input: ApplyForJobInput!): Application!
    subscribe(email: String!, paymentMethodId: String!, lifetime: Boolean!): SubscriptionResult
    cancelSubscription(subscriptionId: String!): SubscriptionResult
  }

  type Subscription {
    applicationMade(jobId: ID!): Application!
  }

  type AuthPayload {
    token: String!
    refreshToken: String!
    user: User!
}

  type Job {
    id: ID!
    title: String!
    description: String!
    location: String!
    category: String!
    skillLevel: String!
    company: String
    user: User!
    applications: [Application!]!
   
  }

  type User {
    id: ID!
    name: String!
    email: String!
    jobs: [Job!]!
    applications: [Application!]!
    cvPath: String!

    
  }

  input UploadFileInput {
    filename: String!
    mimetype: String!
    encoding: String!
    createReadStream: Upload!
}


  type Application {
    id: ID!
    job: Job!
    user: User!
  }

  type SubscriptionResult {
  success: Boolean!
  subscription: Subscription
  message: String
}

type Subscription {
  id: String!
  customerId: String!
  priceId: String!
}

enum SortOrder {
    asc
    desc
  }
scalar DateTime
`;

export { typeDefs as default };
