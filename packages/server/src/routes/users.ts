import {Hono} from 'hono'
import {deleteUserById, getUserById, getUsers, insertUser, updateUser} from "../user.service";
import {zValidator} from "@hono/zod-validator";
import {userInput} from "../zodSchema";
import {z} from "zod";
import {hashPassword} from "../util/passwords";
import {jwtMiddleware} from "../middleware/jwtAuth";
import {requireRole} from "../middleware/requireRole";


const idParamSchema = z.object({
  id: z.coerce.number()
})

export const usersApp = new Hono()

  .use('*', jwtMiddleware)
  .use('*', requireRole(true))

  .get('/', async (c) => {
    const users = await getUsers();
    return c.json(users);
  })

  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const user = await getUserById(+id);
    if (!user) {
      return c.json({error: 'User not found'}, 404);
    }
    return c.json(user);
  })

  .post('/', zValidator('json', userInput), async (c) => {
    const user = await c.req.json();

    if (!user.password) throw new Error("Password is required");

    const hashedPassword = await hashPassword(user.password);
    const userHashedPassword = {...user, password: hashedPassword};

    const createdUser = await insertUser(userHashedPassword);
    return c.json(createdUser);
  })

  .put('/:id',
    zValidator('param', idParamSchema),
    zValidator('json', userInput.partial()),
    async (c) => {
      const id = c.req.param('id');
      const user = await c.req.json();

      if (user.password) {
        user.password = await hashPassword(user.password);
      }

      const updatedUser = await updateUser(+id, user);
      return c.json(updatedUser);
    })

  .delete('/:id',
    zValidator('param', idParamSchema),
    async (c) => {
      const {id} = c.req.valid('param');
      await deleteUserById(id);
      return c.json({message: 'User deleted'});
    })
