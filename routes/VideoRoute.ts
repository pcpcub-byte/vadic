import { Elysia } from 'elysia';
import { videoController } from '../controlers/videoController';

export const videoRoutes = new Elysia()
  .use(videoController);

export default videoRoutes;
