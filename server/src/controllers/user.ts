import { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

// Get API configs from environment variables
const API_BASE_URL = process.env.API_BASE_URL;
const AUTH_TOKEN = process.env.AUTH_TOKEN;

// Simple memory cache for API results
const cache = {
  data: new Map(),
  timestamp: new Map(),
  
  set(key: string, value: any, ttlSeconds: number = 60) {
    this.data.set(key, value);
    this.timestamp.set(key, Date.now() + (ttlSeconds * 1000));
  },
  
  get(key: string) {
    if (!this.data.has(key)) return null;
    
    const expiry = this.timestamp.get(key);
    if (expiry && Date.now() > expiry) {
      this.data.delete(key);
      this.timestamp.delete(key);
      return null;
    }
    
    return this.data.get(key);
  },
  
  ttl(key: string) {
    if (!this.timestamp.has(key)) return 0;
    const timeLeft = Math.max(0, this.timestamp.get(key) - Date.now());
    return Math.floor(timeLeft / 1000);
  }
};

// Gets the top 5 users with the most posts
export const topUsers = async(req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const cacheKey = 'topFiveUsers';
    
    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
        return res.status(200).json({
          status: "success",
          message: "Top 5 users fetched from cache",
          data: cachedResult,
          source: "cache",
          ttl: cache.ttl(cacheKey)
        });
      }
    }

    // Get all users
    const usersResponse = await fetch(`${API_BASE_URL}/test/users`, {
      headers: { 
        'Cache-Control': 'max-age=60',
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    const usersData = await usersResponse.json();
    
    // Check if we have the expected data structure
    if (!usersData.data || typeof usersData.data !== 'object') {
      throw new Error('Invalid users data structure received from API');
    }
    
    const users = usersData.data;
    
    // Get posts for all users
    const userIds = Object.keys(users);
    const postPromises = userIds.map(userId => 
      fetch(`${API_BASE_URL}/test/users/${userId}/posts`, {
        headers: { 
          'Cache-Control': 'max-age=60',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      })
      .then(response => response.json())
      .then(postsData => ({
        id: userId,
        name: users[userId],
        postCount: postsData.data ? postsData.data.length : 0
      }))
    );
    
    const userPostCounts = await Promise.all(postPromises);
    
    const topFiveUsers = userPostCounts
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 5);
    
    // Save to cache
    cache.set(cacheKey, topFiveUsers, 60);
    
    return res.status(200).json({
      status: "success",
      message: "Top 5 users fetched successfully",
      data: topFiveUsers,
      source: "api",
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error fetching top users:", error);
    
    const cachedResult = cache.get('topFiveUsers');
    if (cachedResult) {
      return res.status(200).json({
        status: "success",
        message: "Returning cached results due to error",
        data: cachedResult,
        source: "cache-fallback",
        ttl: cache.ttl('topFiveUsers')
      });
    }
    
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch top users"
    });
  }
};

// Gets posts sorted by popularity or recency
export const getTopLatestPosts = async(req: Request, res: Response) => {
  try {
    const { type = 'popular' } = req.query;
    
    if (type !== 'popular' && type !== 'latest') {
      return res.status(400).json({
        status: "error",
        message: "Invalid type parameter. Use 'popular' or 'latest'"
      });
    }

    // Get all posts
    const postsResponse = await fetch(`${API_BASE_URL}/test/posts`, {
      headers: {
        'Cache-Control': 'max-age=60',
        // 'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    const postsData = await postsResponse.json();
    
    // Check if we have the expected data structure
    if (!postsData.data || !Array.isArray(postsData.data)) {
      throw new Error('Invalid posts data structure received from API');
    }
    
    const posts = postsData.data;
    
    let resultPosts = [];
    
    if (type === 'popular') {
      let maxCommentCount = 0;
      
      posts.forEach(post => {
        const commentCount = post.comments?.length || 0;
        maxCommentCount = Math.max(maxCommentCount, commentCount);
      });
      
      resultPosts = posts.filter(post => {
        const commentCount = post.comments?.length || 0;
        return commentCount === maxCommentCount;
      });
      
    } else {
      // Get 5 newest posts
      resultPosts = posts
        .sort((a, b) => new Date(b.timestamp || Date.now()).getTime() - new Date(a.timestamp || Date.now()).getTime())
        .slice(0, 5);
    }
    
    return res.status(200).json({
      status: "success",
      message: `${type === 'popular' ? 'Popular' : 'Latest'} posts fetched successfully`,
      data: resultPosts,
      source: "api",
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Error fetching ${req.query.type || 'popular'} posts:`, error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch posts"
    });
  }
};