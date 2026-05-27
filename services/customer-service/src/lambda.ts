import configureApp from '@codegenie/serverless-express';
import app from './app';
export const handler = configureApp({ app });