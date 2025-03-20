import { Router, Request, Response } from 'express';
import { topUsers,getTopLatestPosts} from '../controllers/user';

const router = Router();


router.get('/users',topUsers);

router.post('/posts',getTopLatestPosts);


export default router;
