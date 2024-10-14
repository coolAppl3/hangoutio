import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export function fallbackMiddleware(req: Request, res: Response): void {
  const requestPath: string = req.path;
  const acceptsHtml: boolean = req.headers.accept?.includes('text/html') === true;

  if (requestPath.endsWith('.html') && acceptsHtml) {
    sendBrowserResponse(res, 404);
    return;
  };

  res.json({ success: false, message: 'Resource not found.' })
};

function sendBrowserResponse(res: Response, errCode: number): void {
  const htmlFilePath: string = path.join(__dirname, '../../public', `${errCode}.html`);

  if (!fs.existsSync(htmlFilePath)) {
    res.status(errCode).json({ success: false, message: 'Page not found.' });
    return;
  };

  res.status(errCode).sendFile(htmlFilePath);
};