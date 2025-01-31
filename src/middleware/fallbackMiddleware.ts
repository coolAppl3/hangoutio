import { Request, Response } from 'express';
import path from 'path';

export function fallbackMiddleware(req: Request, res: Response): void {
  const acceptsHtml: boolean = req.headers.accept?.includes('text/html') === true;

  if (acceptsHtml) {
    sendBrowserResponse(res, 404);
    return;
  };

  res.status(404).json({ message: 'Resource not found.' });
};

function sendBrowserResponse(res: Response, errCode: number): void {
  const errorPagePath: string = path.join(__dirname, '../../public/errorPages', `${errCode}.html`);

  res.status(errCode).sendFile(errorPagePath, (err: Error) => {
    if (!err) {
      return;
    };

    res.status(500).send('Internal server error.');
  });
};