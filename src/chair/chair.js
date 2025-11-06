// order.js
import { createProduct } from './product.js';

export function processOrder(user, productName) {
    console.log(`[Order] Processing order for user: ${user.name}...`);
    // This is the dependency on product.js
    const product = createProduct(productName);
    console.log(`[Order] Order created for product: ${product.name}.`);
}
