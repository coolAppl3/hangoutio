import express, { Router, Request, Response, NextFunction } from "express";
import path from "path";

export const htmlRouter: Router = express.Router();

htmlRouter.get('/:page', async (req: Request, res: Response, next: NextFunction) => {
  const page: string = req.params.page;

  if (page.includes('.') && !page.endsWith('.html')) {
    next();
    return;
  };

  const sanitizedPage: string = path.basename(page, '.html');
  const filePath: string = path.join(__dirname, '../../public', `${sanitizedPage === 'home' ? 'index' : sanitizedPage}.html`);

  res.sendFile(filePath, (err: Error) => {
    if (!err) {
      return;
    };

    const notFoundPath: string = path.join(__dirname, '../../public/errorPages', '404.html');
    res.sendFile(notFoundPath, (fallbackError: Error) => {
      if (!fallbackError) {
        return;
      };

      res.status(500).send('Internal server error.');
    });
  });
});