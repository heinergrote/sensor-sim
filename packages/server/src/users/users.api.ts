import {Hono} from 'hono'
import {deleteUserById, getUserById, getUsers, insertUser, updateUser} from "./user.repository";
import {zValidator} from "@hono/zod-validator";
import {hashPassword} from "../util/passwords";
import {jwtMiddleware} from "../middleware/jwtAuth";
import {requireRole} from "../middleware/requireRole";
import {createUserSchema, updateUserSchema, userIdParamSchema, userSessionParamSchema} from "@sensor-sim/shared";
import {toCreate, toDto, toUpdate} from "./users.mapping";
import {getActiveSessions, revokeUserSession} from "../sessions/sessions.repository";
import {toDto as sessionToDto} from "../sessions/sessions.mapping";
import {HonoGlobalVars} from "../types";

export const usersApp = new Hono<{ Variables: HonoGlobalVars }>()

  .use('*', jwtMiddleware)
  .use('*', requireRole(true))

  .get('/', async (c) => {
    const users = await getUsers();
    return c.json(users.map(toDto));
  })

  .get('/:id',
    zValidator('param', userIdParamSchema),
    async (c) => {
      const {id} = c.req.valid('param');
      const userRow = await getUserById(id);
      if (!userRow) {
        return c.json({error: 'User not found'}, 404);
      }
      return c.json(toDto(userRow));
    })

  .get('/:id/sessions',
    zValidator('param', userIdParamSchema),
    async (c) => {
      const {id} = c.req.valid('param');
      const sessions = await getActiveSessions(id);
      return c.json(sessions.map(row => sessionToDto(row, c.var.sessionId)));
    })

  .delete('/:id/sessions/:sessionId',
    zValidator('param', userSessionParamSchema),
    async (c) => {
      const {id, sessionId} = c.req.valid('param');
      if (!(await revokeUserSession(id, sessionId))) {
        return c.json({error: 'Session not found'}, 404);
      }
      return c.body(null, 204);
    })

  .post('/',
    zValidator('json', createUserSchema),
    async (c) => {
      const user = c.req.valid("json")

      const hashedPassword = await hashPassword(user.password);
      const userWithHashedPassword = {...user, password: hashedPassword};

      const [createdUser] = await insertUser(toCreate(userWithHashedPassword));
      return c.json(toDto(createdUser));
    })

  .put('/:id',
    zValidator('param', userIdParamSchema),
    zValidator('json', updateUserSchema),
    async (c) => {
      const {id} = c.req.valid('param');
      const user = c.req.valid("json");

      if (user.password) {
        user.password = await hashPassword(user.password);
      }

      const updatedUser = await updateUser(id, toUpdate(user));
      return c.json(toDto(updatedUser));
    })

  .delete('/:id',
    zValidator('param', userIdParamSchema),
    async (c) => {
      const {id} = c.req.valid('param');
      const deletedUser = await deleteUserById(id);
      return c.json(toDto(deletedUser));
    })
