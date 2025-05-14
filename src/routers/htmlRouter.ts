import express, { Router, Request, Response, NextFunction } from "express";
import path from "path";
import { logUnexpectedError } from "../logs/errorLogger";

export const htmlRouter: Router = express.Router();

htmlRouter.get('/:page', async (req: Request, res: Response, next: NextFunction) => {
  const page: string | undefined = req.params.page;

  if (!page) {
    next();
    return;
  };

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

    const notFoundPagePath: string = path.join(__dirname, '../../public/errorPages', '404.html');
    res.sendFile(notFoundPagePath, async (fallbackError: Error) => {
      if (!fallbackError || res.headersSent) {
        return;
      };

      res.status(500).send('Internal server error.');
      await logUnexpectedError(req, { message: 'Failed to send 404 page.', trace: null });
    });
  });
});