// Replace this body with your agent/framework. Input contains policy, state,
// request and supporting_text_untrusted. Credentials stay in your local process.
// Expected answers and fixtures are deliberately NOT passed to the adapter.
export async function propose(input) {
 return {kind:'clarify',command:null,message:'Example adapter only: connect your agent here.'};
}
