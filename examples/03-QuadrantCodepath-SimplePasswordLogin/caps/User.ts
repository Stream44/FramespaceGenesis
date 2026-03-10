export async function capsule({
    encapsulate,
    CapsulePropertyTypes,
    makeImportStack
}: {
    encapsulate: any
    CapsulePropertyTypes: any
    makeImportStack: any
}) {
    return encapsulate({
        '#@stream44.studio/encapsulate/spine-contracts/CapsuleSpineContract.v0': {
            '#@stream44.studio/encapsulate/structs/Capsule': {},

            // Dimension: Column
            '#../view/Columns/Person': {},

            // Dimension: Row
            '#../view/Rows/Client': {},

            '#': {
                loginForm: {
                    type: CapsulePropertyTypes.Mapping,
                    value: './LoginForm',
                },
                login: {
                    type: CapsulePropertyTypes.Function,
                    value: function (this: any, email: string, password: string) {
                        this.loginForm.setEmail(email)
                        this.loginForm.setPassword(password)
                        return this.loginForm.submit()
                    }
                },
            }
        }
    }, {
        importMeta: import.meta,
        importStack: makeImportStack(),
        capsuleName: capsule['#'],
    })
}
capsule['#'] = '@stream44.studio/FramespaceGenesis/examples/03-QuadrantCodepath-SimplePasswordLogin/caps/User'
