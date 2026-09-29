import {Hono} from 'hono'
import {deleteUserById, getUserById, getUsers, insertUser, updateUser} from "./user.repository";
import {zValidator} from "@hono/zod-validator";
import {hashPassword} from "../util/passwords";
import {jwtMiddleware} from "../middleware/jwtAuth";
import {requireRole} from "../middleware/requireRole";
import {createUserSchema, updateUserSchema, userIdParamSchema} from "@sensor-sim/shared";
import {toDto, toInsert, toUpdate} from "./users.mappings";

export const usersApp = new Hono()

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

  .post('/',
    zValidator('json', createUserSchema),
    async (c) => {
      const user = c.req.valid("json")

      const hashedPassword = await hashPassword(user.password);
      const userHashedPassword = {...user, password: hashedPassword};

      const [createdUser] = await insertUser(toInsert(userHashedPassword));
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
