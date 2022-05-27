import { accessDenied, allOk, assertOk } from '@medplum/core';
import { Project, ProjectMembership, Reference } from '@medplum/fhirtypes';
import { Request, Response, Router } from 'express';
import { body, check, validationResult } from 'express-validator';
import { asyncWrap } from '../async';
import { invalidRequest, sendOutcome, systemRepo } from '../fhir';
import { authenticateToken } from '../oauth';
import { sendEmail } from './email';

export const emailRouter = Router();
emailRouter.use(authenticateToken);

const sendEmailValidators = [
  check('content-type').equals('application/json'),
  body('to').notEmpty().withMessage('To is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
];

emailRouter.post(
  '/send',
  sendEmailValidators,
  asyncWrap(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      sendOutcome(res, invalidRequest(errors));
      return;
    }

    // Make sure the user project has the email feature enabled
    const [projectOutcome, project] = await systemRepo.readReference(
      (res.locals.membership as ProjectMembership).project as Reference<Project>
    );
    assertOk(projectOutcome, project);
    if (!project.features?.includes('email')) {
      sendOutcome(res, accessDenied);
      return;
    }

    await sendEmail(req.body);
    sendOutcome(res, allOk);
  })
);