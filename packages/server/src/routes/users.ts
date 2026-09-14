import {Hono} from 'hono'
import {deleteUserById, getUserById, getUsers, insertUser, updateUser} from "../user.service";
import {zValidator} from "@hono/zod-validator";
import {userInput} from "../zodSchema";

const app = new Hono()

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
    const createdUser = await insertUser(user);
    return c.json(createdUser);
  })

  .put('/:id', zValidator('json', userInput.partial()), async (c) => {
    const id = c.req.param('id');
    const user = await c.req.json();
    const updatedUser = await updateUser(+id, user);
    return c.json(updatedUser);
  })

  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    await deleteUserById(+id);
    return c.json({message: 'User deleted'});
  })

export default app